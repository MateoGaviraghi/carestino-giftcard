"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import GiftCard, { GiftCardData } from "@/components/GiftCard";
import { generateSecurityCode, formatDate } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { generateGiftCardVideo } from "@/lib/generateVideo";

interface AdminCard {
  id: string;
  code: string;
  recipientName: string;
  amount: string;
  isProduct: boolean;
  date: string;
  status: "ACTIVE" | "USED";
  createdAt: string;
  usedAt: string | null;
  redeemedByName?: string | null;
  redeemedByDni?: string | null;
}

const STATUS_LABEL: Record<AdminCard["status"], string> = {
  ACTIVE: "Activa",
  USED: "Utilizada",
};

const STATUS_COLOR: Record<AdminCard["status"], string> = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  USED: "bg-red-100 text-red-600 border-red-200",
};

// Nombre del archivo descargado: CARESTINO-GIFT-CARD-NOMBRE-DEL-DESTINATARIO
function buildFileName(recipientName: string, fallback: string): string {
  const slug = (recipientName || "")
    .normalize("NFD") // separa acentos; las marcas se vuelven guion abajo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-") // todo lo no alfanumérico -> guion
    .replace(/^-+|-+$/g, ""); // sin guiones al inicio/fin
  return `CARESTINO-GIFT-CARD-${slug || fallback}`;
}

interface FormValues {
  recipientName: string;
  amount: string;
  isProduct: string; // radio inputs always return strings
  productDescription: string;
  date: string;
}

// ── Cola de respaldo ────────────────────────────────────────────────────────
// Si el guardado en la base falla, la gift card no se genera (ver downloadPdf),
// pero los datos quedan acá para poder reintentar sin volver a tipearlos —
// y sobreviven a que se cierre el navegador.
const PENDING_KEY = "carestino:giftcards-pendientes";

interface PendingCard {
  code: string;
  recipientName: string;
  amount: string;
  isProduct: boolean;
  date: string;
  failedAt: string;
}

function readPending(): PendingCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingCard[]) : [];
  } catch {
    return [];
  }
}

function writePending(list: PendingCard[]) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // localStorage lleno o bloqueado: no hay nada que hacer acá
  }
}

// Espera a que React haya pintado el cambio de estado antes de que html2canvas
// capture la tarjeta (si el server asignó otro código, el DOM tiene que tenerlo).
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  // Estado del guardado en base
  const [dbStatus, setDbStatus] = useState<"checking" | "up" | "down">(
    "checking",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastIssued, setLastIssued] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCard[]>([]);
  const [retryingPending, setRetryingPending] = useState(false);

  // Admin state
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setCardsLoading(true);
    try {
      const res = await fetch("/api/giftcards", { cache: "no-store" });
      const json = await res.json();
      if (json.success) setCards(json.data);
    } finally {
      setCardsLoading(false);
    }
  }, []);

  const checkDb = useCallback(async () => {
    // Neon suspende el compute cuando nadie lo usa; el primer ping despues de
    // unos dias lo despierta y puede tardar ~8s. Reintentamos antes de dar la
    // base por caida: marcarla caida al primer fallo dejaba el sistema
    // paralizado mientras la base simplemente estaba despertando.
    for (let intento = 1; intento <= 3; intento++) {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) {
          setDbStatus("up");
          return;
        }
      } catch {
        // sin red, o la funcion se corto: se reintenta abajo
      }
      if (intento < 3) await new Promise((r) => setTimeout(r, 2000));
    }
    setDbStatus("down");
  }, []);

  /**
   * Guarda la gift card en la base y devuelve el código con el que quedó
   * realmente persistida. Si no puede CONFIRMAR la escritura, tira — y el que
   * llama no debe generar ningún archivo: una gift card que no está en la base
   * no se puede canjear después.
   */
  const persistGiftCard = useCallback(
    async (card: Omit<PendingCard, "failedAt">): Promise<string> => {
      let code = card.code;

      // Cada 409 significa que ese código ya lo tiene otra gift card:
      // probamos con uno nuevo en vez de pisarla en silencio.
      for (let intento = 0; intento < 3; intento++) {
        const res = await fetch("/api/giftcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...card, code }),
        });

        const json = await res.json().catch(() => null);

        if (res.ok && json?.success) return code;

        if (res.status === 409) {
          code = generateSecurityCode();
          continue;
        }

        throw new Error(
          json?.error === "Error al guardar la gift card"
            ? "La base de datos no respondió."
            : json?.error || `El servidor respondió ${res.status}.`,
        );
      }

      throw new Error("No se pudo asignar un código único. Recargá la página.");
    },
    [],
  );

  // Guarda los datos para poder reintentar sin volver a tipearlos.
  const queueFailedCard = useCallback(
    (card: Omit<PendingCard, "failedAt">) => {
      const entry: PendingCard = { ...card, failedAt: new Date().toISOString() };
      const list = [...readPending().filter((p) => p.code !== entry.code), entry];
      writePending(list);
      setPending(list);
    },
    [],
  );

  const retryPending = useCallback(async () => {
    setRetryingPending(true);
    try {
      const stillFailing: PendingCard[] = [];
      for (const { failedAt, ...card } of readPending()) {
        try {
          await persistGiftCard(card);
        } catch {
          stillFailing.push({ ...card, failedAt });
        }
      }
      writePending(stillFailing);
      setPending(stillFailing);
      await checkDb();
      await fetchCards();
    } finally {
      setRetryingPending(false);
    }
  }, [persistGiftCard, checkDb, fetchCards]);

  const handleStatusChange = async (
    code: string,
    status: AdminCard["status"],
  ) => {
    setActionLoading(code + status);
    try {
      const res = await fetch(`/api/giftcards/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        // Actualiza la fila al instante con la respuesta del server (sin recargar).
        setCards((prev) =>
          prev.map((c) => (c.code === code ? { ...c, ...json.data } : c)),
        );
      } else {
        await fetchCards();
      }
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

  // Vigila el estado de la base y recupera lo que haya quedado sin guardar.
  useEffect(() => {
    setPending(readPending());
    checkDb();
    const id = setInterval(checkDb, 60_000);
    return () => clearInterval(id);
  }, [checkDb]);

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
    setSaveError(null);
    setLastIssued(null);
    try {
      const payload = {
        code: securityCode,
        recipientName: cardData.recipientName,
        amount: cardData.amount,
        isProduct: cardData.isProduct ?? false,
        date: cardData.date,
      };

      // 1. Guardar en la base ANTES de generar nada. Si la escritura no se puede
      //    confirmar, no se descarga: una gift card que no está en la base no se
      //    puede canjear, y el cliente se entera recién en el mostrador.
      let confirmedCode: string;
      try {
        confirmedCode = await persistGiftCard(payload);
      } catch (dbErr) {
        console.error("No se pudo guardar la gift card:", dbErr);
        queueFailedCard(payload);
        setDbStatus("down");
        setSaveError(
          dbErr instanceof Error
            ? dbErr.message
            : "No se pudo guardar la gift card.",
        );
        return;
      }

      // El server pudo asignar otro código por colisión: la tarjeta que
      // capturamos tiene que mostrar el que realmente quedó guardado.
      if (confirmedCode !== securityCode) {
        setSecurityCode(confirmedCode);
        await nextPaint();
      }
      fetchCards();

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
      pdf.save(
        `${buildFileName(cardData.recipientName, confirmedCode)}.pdf`,
      );

      // Emitida y guardada. La próxima gift card necesita un código nuevo: hasta
      // ahora se generaba uno solo al abrir la página, así que dos tarjetas
      // seguidas compartían código y la segunda nunca llegaba a la base.
      setLastIssued(confirmedCode);
      setSecurityCode(generateSecurityCode());
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Ocurrió un error al generar el PDF. Intentá de nuevo.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [
    fetchCards,
    persistGiftCard,
    queueFailedCard,
    securityCode,
    cardData.recipientName,
    cardData.amount,
    cardData.isProduct,
    cardData.date,
  ]);

  const downloadVideo = useCallback(async () => {
    if (!pdfCardRef.current) return;
    setIsGeneratingVideo(true);
    setVideoProgress(0);
    setSaveError(null);
    setLastIssued(null);
    try {
      const payload = {
        code: securityCode,
        recipientName: cardData.recipientName,
        amount: cardData.amount,
        isProduct: cardData.isProduct ?? false,
        date: cardData.date,
      };

      // 1. Guardar en la base ANTES de generar nada (mismo criterio que el PDF).
      let confirmedCode: string;
      try {
        confirmedCode = await persistGiftCard(payload);
      } catch (dbErr) {
        console.error("No se pudo guardar la gift card (video):", dbErr);
        queueFailedCard(payload);
        setDbStatus("down");
        setSaveError(
          dbErr instanceof Error
            ? dbErr.message
            : "No se pudo guardar la gift card.",
        );
        return;
      }

      if (confirmedCode !== securityCode) {
        setSecurityCode(confirmedCode);
        await nextPaint();
      }
      fetchCards();

      // 2. Capture the gift card as an image
      await new Promise((r) => setTimeout(r, 300));
      const computedFont = window.getComputedStyle(
        pdfCardRef.current,
      ).fontFamily;
      const canvas = await html2canvas(pdfCardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#FAF7F2",
        logging: false,
        onclone: (_doc, clonedEl) => {
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

      // 2. Convert canvas to Image element
      const img = new Image();
      img.src = canvas.toDataURL("image/png");
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      // 3. Generate animated video
      const blob = await generateGiftCardVideo({
        cardImage: img,
        recipientName: cardData.recipientName,
        onProgress: setVideoProgress,
      });

      // 4. Download
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${buildFileName(cardData.recipientName, confirmedCode)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      setLastIssued(confirmedCode);
      setSecurityCode(generateSecurityCode());
    } catch (err) {
      console.error("Error generando video:", err);
      alert("Ocurrió un error al generar el video. Intentá de nuevo.");
    } finally {
      setIsGeneratingVideo(false);
      setVideoProgress(0);
    }
  }, [
    fetchCards,
    persistGiftCard,
    queueFailedCard,
    securityCode,
    cardData.recipientName,
    cardData.amount,
    cardData.isProduct,
    cardData.date,
  ]);

  return (
    <main className="min-h-screen bg-[#f8f4ef] py-10 px-4">
      {/* ── Header ── */}
      <header className="max-w-5xl mx-auto mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-4xl font-black text-[#ea7014] tracking-tight">
            Carestino
          </h1>
          <p className="text-[#ea7014]/70 font-semibold mt-0.5 tracking-wide text-sm uppercase">
            Generador de Gift Cards
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/scan"
            className="text-sm font-bold text-white bg-[#ea7014] hover:bg-[#d4620e] transition-colors py-2 px-4 rounded-xl shadow-sm whitespace-nowrap"
          >
            📷 Lector QR
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm font-bold text-[#ea7014] border border-[#ea7014]/30 hover:bg-[#ea7014]/10 transition-colors py-2 px-4 rounded-xl whitespace-nowrap"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* ── La base no respondió al chequeo: avisar, sin bloquear la emisión ── */}
      {dbStatus === "down" && (
        <div className="max-w-5xl mx-auto mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="font-black text-amber-700 text-sm uppercase tracking-wide">
              La base está tardando en responder
            </p>
            <p className="text-amber-700/80 text-sm mt-0.5">
              Podés emitir igual: si el guardado no se confirma, la gift card no
              se descarga y te avisa. La base se despierta sola y el primer
              intento del día puede tardar unos segundos.
            </p>
          </div>
          <button
            type="button"
            onClick={checkDb}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Reintentar conexión
          </button>
        </div>
      )}

      {/* ── Gift cards que no llegaron a guardarse ── */}
      {pending.length > 0 && (
        <div className="max-w-5xl mx-auto mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-black text-amber-700 text-sm uppercase tracking-wide">
              {pending.length} gift card{pending.length > 1 ? "s" : ""} sin
              guardar
            </p>
            <p className="text-amber-700/80 text-sm mt-0.5 break-words">
              {pending
                .map((p) => `${p.recipientName} (${p.code})`)
                .join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={retryPending}
            disabled={retryingPending}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {retryingPending ? "Reintentando..." : "Reintentar guardado"}
          </button>
        </div>
      )}

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* ══════════ FORMULARIO ══════════ */}
        <section className="bg-white rounded-2xl shadow-sm border border-[#ea7014]/10 p-6">
          <h2 className="text-xl font-black text-[#ea7014] mb-6 uppercase tracking-wide">
            Datos del Gift Card
          </h2>

          <form
            onSubmit={handleSubmit(() => downloadPdf())}
            noValidate
            className="space-y-3"
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
                    className={`px-2 sm:px-4 py-2.5 text-center text-sm font-bold transition-colors whitespace-nowrap ${
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
                    className={`px-2 sm:px-4 py-2.5 text-center text-sm font-bold transition-colors whitespace-nowrap ${
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
              <p className="text-[#ea7014] font-black font-mono tracking-widest text-xl sm:text-2xl break-all">
                {securityCode}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Identifica esta gift card de forma única.
              </p>
            </div>
          </form>
        </section>

        {/* ══════════ VISTA PREVIA EN TIEMPO REAL ══════════ */}
        <section className="flex flex-col items-center gap-6">
          <h2 className="text-sm font-bold text-[#ea7014]/60 uppercase tracking-widest text-center">
            Vista previa en tiempo real
          </h2>
          <div className="shadow-2xl shadow-[#ea7014]/20 rounded-lg overflow-hidden w-full max-w-sm">
            <GiftCard data={cardData} />
          </div>

          {/* Botones de descarga — visibles directamente */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <button
              type="button"
              onClick={() => handleSubmit(() => downloadPdf())()}
              disabled={isGeneratingPdf}
              className="flex-1 flex items-center justify-center gap-2 bg-[#ea7014] hover:bg-[#d4620e] disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
            >
              {isGeneratingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                    className="shrink-0"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Descargar PDF
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(() => downloadVideo())()}
              disabled={isGeneratingVideo}
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-md"
            >
              {isGeneratingVideo ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {videoProgress}%
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
                    className="shrink-0"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  Video WA
                </>
              )}
            </button>
          </div>

          {saveError && (
            <div className="w-full max-w-sm rounded-xl border-2 border-red-300 bg-red-50 p-3 -mt-2">
              <p className="font-bold text-red-700 text-sm">
                No se generó la gift card
              </p>
              <p className="text-red-600 text-xs mt-0.5">
                {saveError} Los datos quedaron guardados para reintentar — no se
                descargó nada para no entregar una gift card sin registrar.
              </p>
            </div>
          )}

          {lastIssued && !saveError && (
            <div className="w-full max-w-sm rounded-xl border-2 border-green-300 bg-green-50 p-3 -mt-2">
              <p className="font-bold text-green-700 text-sm">
                Guardada en la base y descargada
              </p>
              <p className="text-green-700/80 text-xs mt-0.5 font-mono tracking-wider">
                {lastIssued}
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center max-w-xs -mt-2">
            Completá el formulario y hacé clic para crear y descargar tu gift
            card.
          </p>
        </section>
      </div>

      {/* Hidden off-screen card for PDF capture (nativeSize keeps position:relative hack for html2canvas) */}
      <div
        aria-hidden
        className="fixed top-0 -left-2499.75 pointer-events-none"
      >
        <GiftCard data={cardData} ref={pdfCardRef} nativeSize />
      </div>

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
            <div className="grid grid-cols-3 gap-4">
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
                title="Filtrar por estado"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border-2 border-[#ea7014]/30 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-[#ea7014] bg-white"
              >
                <option value="ALL">Todos los estados</option>
                <option value="ACTIVE">Activas</option>
                <option value="USED">Utilizadas</option>
              </select>
              <button
                onClick={fetchCards}
                className="bg-[#ea7014]/10 hover:bg-[#ea7014]/20 text-[#ea7014] font-bold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Actualizar
              </button>
            </div>

            {/* Tabla desktop */}
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
                <>
                  {/* Cards para mobile */}
                  <div className="sm:hidden divide-y divide-gray-100">
                    {filtered.map((card) => (
                      <div key={card.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-[#ea7014]/80 tracking-wider">
                            {card.code}
                          </span>
                          <span
                            className={`border rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[card.status]}`}
                          >
                            {STATUS_LABEL[card.status]}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800 text-sm">
                            {card.recipientName}
                          </span>
                          <span className="font-semibold text-[#ea7014] text-sm">
                            {card.isProduct ? card.amount : `$ ${card.amount}`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {card.date}
                          </span>
                          <div className="flex items-center gap-2">
                            {card.status !== "USED" && (
                              <button
                                onClick={() =>
                                  handleStatusChange(card.code, "USED")
                                }
                                disabled={actionLoading === card.code + "USED"}
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
                            <button
                              onClick={() => handleDeleteCard(card.code)}
                              disabled={actionLoading === card.code + "delete"}
                              className="bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 text-xs font-bold px-2 py-1.5 rounded-lg transition-colors"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                        {card.status === "USED" && card.redeemedByName && (
                          <div className="text-xs text-gray-600 leading-tight pt-1">
                            <span className="text-gray-400">
                              Retirado por:
                            </span>{" "}
                            <span className="font-semibold">
                              {card.redeemedByName}
                            </span>
                            {card.redeemedByDni && (
                              <>
                                {" · "}
                                <span className="text-gray-400">DNI:</span>{" "}
                                <span className="font-semibold">
                                  {card.redeemedByDni}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Tabla para desktop */}
                  <div className="hidden sm:block overflow-x-auto">
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
                              {card.status === "USED" &&
                                card.redeemedByName && (
                                  <p className="text-xs text-gray-600 mt-1 leading-tight">
                                    <span className="text-gray-400">
                                      Retirado por:
                                    </span>{" "}
                                    <span className="font-semibold">
                                      {card.redeemedByName}
                                    </span>
                                    {card.redeemedByDni && (
                                      <>
                                        <br />
                                        <span className="text-gray-400">
                                          DNI:
                                        </span>{" "}
                                        <span className="font-semibold">
                                          {card.redeemedByDni}
                                        </span>
                                      </>
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
                </>
              )}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
