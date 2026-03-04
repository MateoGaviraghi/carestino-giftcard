"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import GiftCard, { GiftCardData } from "@/components/GiftCard";
import { generateSecurityCode, formatDate } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface AdminCard {
  id: string;
  code: string;
  recipientName: string;
  amount: string;
  isProduct: boolean;
  date: string;
  status: "ACTIVE" | "USED" | "CANCELLED";
  createdAt: string;
  usedAt: string | null;
}

const STATUS_LABEL: Record<AdminCard["status"], string> = {
  ACTIVE: "Activa",
  USED: "Utilizada",
  CANCELLED: "Cancelada",
};

const STATUS_COLOR: Record<AdminCard["status"], string> = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  USED: "bg-red-100 text-red-600 border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border-gray-200",
};

interface FormValues {
  recipientName: string;
  amount: string;
  isProduct: string; // radio inputs always return strings
  productDescription: string;
  date: string;
}

const INPUT_CLASS =
  "w-full border-2 border-[#ea7014]/40 rounded-lg px-4 py-3 text-gray-800 font-medium bg-white focus:outline-none focus:border-[#ea7014] focus:ring-2 focus:ring-[#ea7014]/20 transition placeholder-gray-400";

const LABEL_CLASS =
  "block text-[#ea7014] font-bold mb-1.5 text-sm uppercase tracking-wide";

export default function Home() {
  const router = useRouter();

  const {
    register,
    watch,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      recipientName: "",
      amount: "",
      isProduct: "false",
      productDescription: "",
      date: "",
    },
  });

  const watchedValues = watch();
  const [securityCode, setSecurityCode] = useState<string>("");
  const [today, setToday] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Admin state
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const res = await fetch("/api/giftcards");
      const json = await res.json();
      if (json.success) setCards(json.data);
    } finally {
      setCardsLoading(false);
    }
  }, []);

  const handleStatusChange = async (
    code: string,
    status: AdminCard["status"],
  ) => {
    setActionLoading(code + status);
    try {
      await fetch(`/api/giftcards/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchCards();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCard = async (code: string) => {
    if (!confirm(`¿Seguro que querés eliminar la gift card ${code}?`)) return;
    setActionLoading(code + "delete");
    try {
      await fetch(`/api/giftcards/${code}`, { method: "DELETE" });
      await fetchCards();
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Generate random/dynamic values only on the client to avoid SSR hydration mismatch
  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    setSecurityCode(generateSecurityCode());
    setToday(todayStr);
    setValue("date", todayStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const pdfCardRef = useRef<HTMLDivElement>(null);

  const cardData: GiftCardData = {
    recipientName: watchedValues.recipientName || "NOMBRE",
    amount:
      watchedValues.isProduct === "true"
        ? watchedValues.productDescription
        : watchedValues.amount || "",
    isProduct: watchedValues.isProduct === "true",
    date: watchedValues.date ? formatDate(watchedValues.date) : "",
    securityCode,
  };

  const downloadPdf = useCallback(async () => {
    if (!pdfCardRef.current) return;
    setIsGeneratingPdf(true);
    try {
      // 1. Guardar la gift card en la base de datos
      try {
        await fetch("/api/giftcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: securityCode,
            recipientName: cardData.recipientName,
            amount: cardData.amount,
            isProduct: cardData.isProduct ?? false,
            date: cardData.date,
          }),
        });
        // Refresh admin table immediately
        fetchCards();
      } catch (dbErr) {
        // No bloqueamos la descarga si falla el guardado
        console.warn("No se pudo guardar en la base de datos:", dbErr);
      }

      // 2. Wait for images and fonts to fully load
      await new Promise((r) => setTimeout(r, 300));

      // Pre-load icon images to ensure html2canvas can draw them
      const imgEls = pdfCardRef.current.querySelectorAll("img");
      await Promise.all(
        Array.from(imgEls).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve();
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
        ),
      );

      // Resolve the CSS-variable to the real font-face name so html2canvas
      // can use it even if it fails to resolve var() in the clone.
      const computedFont = window.getComputedStyle(
        pdfCardRef.current,
      ).fontFamily;

      const PX_TO_MM = 25.4 / 96;
      const cardW = pdfCardRef.current.offsetWidth;
      const cardH = pdfCardRef.current.offsetHeight;
      const pdfW = cardW * PX_TO_MM;
      const pdfH = cardH * PX_TO_MM;

      const canvas = await html2canvas(pdfCardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#FAF7F2",
        logging: false,
        onclone: (_doc, clonedEl) => {
          // Force the resolved font on every element inside the clone
          // but preserve monospace on the security code and skip non-HTML elements
          clonedEl.style.fontFamily = computedFont;
          clonedEl.querySelectorAll("*").forEach((child) => {
            if (
              child instanceof HTMLElement &&
              !(child instanceof HTMLImageElement) &&
              !child.style.fontFamily.includes("monospace")
            ) {
              child.style.fontFamily = computedFont;
            }
          });
        },
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: pdfH > pdfW ? "portrait" : "landscape",
        unit: "mm",
        format: [pdfW, pdfH],
      });
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`giftcard-carestino-${securityCode}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Ocurrió un error al generar el PDF. Intentá de nuevo.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [
    fetchCards,
    securityCode,
    cardData.recipientName,
    cardData.amount,
    cardData.isProduct,
    cardData.date,
  ]);

  return (
    <main className="min-h-screen bg-[#f8f4ef] py-10 px-4">
      {/* ── Header ── */}
      <header className="text-center mb-10 relative">
        <h1 className="text-4xl font-black text-[#ea7014] tracking-tight">
          Carestino
        </h1>
        <p className="text-[#ea7014]/70 font-semibold mt-1 tracking-wide text-sm uppercase">
          Generador de Gift Cards
        </p>
        <button
          onClick={handleLogout}
          className="absolute right-0 top-0 text-xs font-bold text-[#ea7014]/50 hover:text-[#ea7014] transition-colors py-1 px-2 rounded-lg hover:bg-[#ea7014]/10"
        >
          Cerrar sesión
        </button>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* ══════════ FORMULARIO ══════════ */}
        <section className="bg-white rounded-2xl shadow-sm border border-[#ea7014]/10 p-8">
          <h2 className="text-xl font-black text-[#ea7014] mb-6 uppercase tracking-wide">
            Datos del Gift Card
          </h2>

          <form
            onSubmit={handleSubmit(() => setShowModal(true))}
            noValidate
            className="space-y-5"
          >
            {/* Nombre */}
            <div>
              <label className={LABEL_CLASS}>Nombre del destinatario *</label>
              <input
                {...register("recipientName", {
                  required: "El nombre es obligatorio",
                })}
                placeholder="Ej: María González"
                className={INPUT_CLASS}
              />
              {errors.recipientName && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.recipientName.message}
                </p>
              )}
            </div>

            {/* Toggle monto / producto */}
            <div>
              <label className={LABEL_CLASS}>Tipo de gift card</label>
              <div className="flex rounded-lg overflow-hidden border-2 border-[#ea7014]/30">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    {...register("isProduct")}
                    value="false"
                    className="sr-only"
                  />
                  <div
                    className={`px-4 py-2.5 text-center text-sm font-bold transition-colors ${
                      watchedValues.isProduct !== "true"
                        ? "bg-[#ea7014] text-white"
                        : "bg-white text-[#ea7014]"
                    }`}
                  >
                    Monto en $
                  </div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    {...register("isProduct")}
                    value="true"
                    className="sr-only"
                  />
                  <div
                    className={`px-4 py-2.5 text-center text-sm font-bold transition-colors ${
                      watchedValues.isProduct === "true"
                        ? "bg-[#ea7014] text-white"
                        : "bg-white text-[#ea7014]"
                    }`}
                  >
                    Producto / Servicio
                  </div>
                </label>
              </div>
            </div>

            {/* Monto o Producto */}
            {watchedValues.isProduct !== "true" ? (
              <div>
                <label className={LABEL_CLASS}>Monto *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ea7014] font-black text-lg">
                    $
                  </span>
                  <input
                    {...register("amount", {
                      validate: (v) =>
                        watchedValues.isProduct === "true" ||
                        !!v ||
                        "Ingres\u00e1 un monto",
                    })}
                    type="number"
                    min={0}
                    placeholder="0"
                    className={`${INPUT_CLASS} pl-9`}
                  />
                </div>
                {errors.amount && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.amount.message}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className={LABEL_CLASS}>
                  Descripción del producto / servicio *
                </label>
                <input
                  {...register("productDescription", {
                    validate: (v) =>
                      watchedValues.isProduct !== "true" ||
                      !!v ||
                      "Ingresá la descripción",
                  })}
                  placeholder="Ej: Set de ropa recién nacido"
                  className={INPUT_CLASS}
                />
                {errors.productDescription && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.productDescription.message}
                  </p>
                )}
              </div>
            )}

            {/* Fecha */}
            <div>
              <label className={LABEL_CLASS}>Fecha *</label>
              <input
                {...register("date", { required: "La fecha es obligatoria" })}
                type="date"
                max={today}
                className={INPUT_CLASS}
              />
              {errors.date && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.date.message}
                </p>
              )}
            </div>

            {/* Código de seguridad */}
            <div className="bg-[#FAF7F2] rounded-lg p-4 border border-[#ea7014]/20">
              <p className="text-xs text-[#ea7014]/60 font-semibold uppercase tracking-wide mb-1">
                Código de seguridad (generado automáticamente)
              </p>
              <p className="text-[#ea7014] font-black font-mono tracking-widest text-2xl">
                {securityCode}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Identifica esta gift card de forma única.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-[#ea7014] hover:bg-[#d4620e] text-white font-black text-base uppercase tracking-wider py-3.5 rounded-xl transition-colors shadow-md shadow-[#ea7014]/30"
            >
              Previsualizar Gift Card
            </button>
          </form>
        </section>

        {/* ══════════ VISTA PREVIA EN TIEMPO REAL ══════════ */}
        <section className="flex flex-col items-center gap-6">
          <h2 className="text-sm font-bold text-[#ea7014]/60 uppercase tracking-widest self-start">
            Vista previa en tiempo real
          </h2>
          <div className="shadow-2xl shadow-[#ea7014]/20 rounded-lg overflow-hidden w-full max-w-sm">
            <GiftCard data={cardData} />
          </div>

          {/* Botones de descarga — visibles directamente */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <button
              type="button"
              onClick={() => handleSubmit(() => setShowModal(true))()}
              className="flex-1 flex items-center justify-center gap-2 bg-[#ea7014] hover:bg-[#d4620e] text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Descargar PDF
            </button>

            <button
              type="button"
              disabled
              className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-400 font-bold py-3 px-4 rounded-xl cursor-not-allowed"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              Video WA
              <span className="text-xs">(pronto)</span>
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center max-w-xs -mt-2">
            Clic en <strong>Descargar PDF</strong> para previsualizar y
            descargar.
          </p>
        </section>
      </div>

      {/* Hidden off-screen card for PDF capture (nativeSize keeps position:relative hack for html2canvas) */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          pointerEvents: "none",
        }}
      >
        <GiftCard data={cardData} ref={pdfCardRef} nativeSize />
      </div>

      {/* ══════════ MODAL ══════════ */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-[580px] w-full p-6 flex flex-col items-center gap-6">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-lg font-black text-[#ea7014] uppercase tracking-wide">
                Vista previa final
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="shadow-xl rounded-lg">
              <GiftCard data={cardData} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Descargar PDF */}
              <button
                onClick={downloadPdf}
                disabled={isGeneratingPdf}
                className="flex-1 flex items-center justify-center gap-2 bg-[#ea7014] hover:bg-[#d4620e] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-[#ea7014]/25"
              >
                {isGeneratingPdf ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="white"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="white"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Descargar PDF
                  </>
                )}
              </button>

              {/* Video WhatsApp — próximamente */}
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-400 font-bold py-3 px-4 rounded-xl cursor-not-allowed"
                title="Disponible en la Fase 4"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                Video WhatsApp
                <span className="text-xs opacity-70">(pronto)</span>
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Código:{" "}
              <strong className="text-[#ea7014] font-mono">
                {securityCode}
              </strong>
              . Guardá este código antes de cerrar.
            </p>
          </div>
        </div>
      )}
      {/* ══════════ ADMIN DASHBOARD ══════════ */}
      {(() => {
        const filtered = cards.filter((c) => {
          const matchSearch =
            search === "" ||
            c.recipientName.toLowerCase().includes(search.toLowerCase()) ||
            c.code.toLowerCase().includes(search.toLowerCase());
          const matchStatus =
            filterStatus === "ALL" || c.status === filterStatus;
          return matchSearch && matchStatus;
        });
        const counts = {
          total: cards.length,
          active: cards.filter((c) => c.status === "ACTIVE").length,
          used: cards.filter((c) => c.status === "USED").length,
          cancelled: cards.filter((c) => c.status === "CANCELLED").length,
        };
        return (
          <div className="max-w-6xl mx-auto mt-14 space-y-6">
            {/* Section title */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#ea7014]/20" />
              <h2 className="text-sm font-bold text-[#ea7014]/60 uppercase tracking-widest whitespace-nowrap">
                Historial de Gift Cards
              </h2>
              <div className="h-px flex-1 bg-[#ea7014]/20" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: "Total",
                  value: counts.total,
                  color: "text-[#ea7014]",
                },
                {
                  label: "Activas",
                  value: counts.active,
                  color: "text-green-600",
                },
                {
                  label: "Utilizadas",
                  value: counts.used,
                  color: "text-red-500",
                },
                {
                  label: "Canceladas",
                  value: counts.cancelled,
                  color: "text-gray-400",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-xl border border-[#ea7014]/10 p-4 text-center shadow-sm"
                >
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-1">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-[#ea7014]/10 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 border-2 border-[#ea7014]/30 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-[#ea7014]"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border-2 border-[#ea7014]/30 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-[#ea7014] bg-white"
              >
                <option value="ALL">Todos los estados</option>
                <option value="ACTIVE">Activas</option>
                <option value="USED">Utilizadas</option>
                <option value="CANCELLED">Canceladas</option>
              </select>
              <button
                onClick={fetchCards}
                className="bg-[#ea7014]/10 hover:bg-[#ea7014]/20 text-[#ea7014] font-bold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Actualizar
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-[#ea7014]/10 shadow-sm overflow-hidden">
              {cardsLoading ? (
                <div className="py-16 text-center text-gray-400 font-medium">
                  Cargando...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-gray-400 font-medium">
                  No hay gift cards
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#ea7014]/5 border-b border-[#ea7014]/10">
                      <tr>
                        {[
                          "Código",
                          "Destinatario",
                          "Monto / Producto",
                          "Fecha",
                          "Estado",
                          "Acciones",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-3 font-bold text-[#ea7014] uppercase tracking-wide text-xs"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((card) => (
                        <tr
                          key={card.id}
                          className="hover:bg-[#faf7f2] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-[#ea7014]/80 tracking-wider">
                              {card.code}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-gray-800">
                              {card.recipientName}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#ea7014]">
                              {card.isProduct
                                ? card.amount
                                : `$ ${card.amount}`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {card.date}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block border rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[card.status]}`}
                            >
                              {STATUS_LABEL[card.status]}
                            </span>
                            {card.status === "USED" && card.usedAt && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(card.usedAt).toLocaleDateString(
                                  "es-AR",
                                )}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              {card.status !== "USED" && (
                                <button
                                  onClick={() =>
                                    handleStatusChange(card.code, "USED")
                                  }
                                  disabled={
                                    actionLoading === card.code + "USED"
                                  }
                                  className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  ✓ Utilizada
                                </button>
                              )}
                              {card.status === "USED" && (
                                <button
                                  onClick={() =>
                                    handleStatusChange(card.code, "ACTIVE")
                                  }
                                  disabled={
                                    actionLoading === card.code + "ACTIVE"
                                  }
                                  className="bg-[#ea7014] hover:bg-[#d4620e] disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Reactivar
                                </button>
                              )}
                              {card.status !== "CANCELLED" && (
                                <button
                                  onClick={() =>
                                    handleStatusChange(card.code, "CANCELLED")
                                  }
                                  disabled={
                                    actionLoading === card.code + "CANCELLED"
                                  }
                                  className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Cancelar
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCard(card.code)}
                                disabled={
                                  actionLoading === card.code + "delete"
                                }
                                className="bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 text-xs font-bold px-2 py-1.5 rounded-lg transition-colors"
                              >
                                🗑
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
