"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface CardResult {
  code: string;
  recipientName: string;
  amount: string;
  isProduct: boolean;
  date: string;
  status: "ACTIVE" | "USED";
  usedAt: string | null;
}

type ScanState = "idle" | "scanning" | "loading" | "result" | "error";

export default function ScanPage() {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [card, setCard] = useState<CardResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionDone, setActionDone] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any | null>(null);
  const hasScanned = useRef(false);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        // 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    hasScanned.current = false;
    setCard(null);
    setNotFound(false);
    setActionDone(false);
    setScanState("scanning");

    const { Html5Qrcode } = await import("html5-qrcode");
    const qr = new Html5Qrcode("qr-reader");
    scannerRef.current = qr;

    try {
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          if (hasScanned.current) return;
          hasScanned.current = true;
          await stopScanner();
          setScanState("loading");
          await lookupCode(decodedText.trim());
        },
        () => {
          // scan error — ignore, keep scanning
        },
      );
    } catch {
      setScanState("error");
    }
  };

  const lookupCode = async (code: string) => {
    try {
      const res = await fetch(`/api/giftcards/${code}`);
      const json = await res.json();
      if (json.success && json.data) {
        setCard(json.data);
        setScanState("result");
      } else {
        setNotFound(true);
        setScanState("result");
      }
    } catch {
      setScanState("error");
    }
  };

  const handleMarkUsed = async () => {
    if (!card) return;
    setActionLoading(true);
    try {
      await fetch(`/api/giftcards/${card.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "USED" }),
      });
      setCard((c) => (c ? { ...c, status: "USED" } : c));
      setActionDone(true);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f8f4ef] flex flex-col px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8 relative">
        <Link
          href="/"
          className="absolute left-0 top-0 text-sm font-bold text-[#ea7014] border border-[#ea7014]/30 hover:bg-[#ea7014]/10 transition-colors py-2 px-4 rounded-xl"
        >
          ← Menú
        </Link>
        <h1 className="text-3xl font-black text-[#ea7014]">Carestino</h1>
        <p className="text-[#ea7014]/60 font-semibold text-xs uppercase tracking-widest mt-1">
          Lector de Gift Cards
        </p>
      </div>

      {/* IDLE */}
      {scanState === "idle" && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <div className="text-6xl">📷</div>
          <p className="text-gray-600 font-medium text-center max-w-xs">
            Escaneá el código QR de la gift card del cliente para verificar su
            estado.
          </p>
          <button
            onClick={startScanner}
            className="bg-[#ea7014] hover:bg-[#d4620e] text-white font-black text-base uppercase tracking-wider py-4 px-10 rounded-2xl shadow-lg shadow-[#ea7014]/30 transition-colors"
          >
            Escanear QR
          </button>
        </div>
      )}

      {/* SCANNING */}
      {scanState === "scanning" && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-[#ea7014]/70 uppercase tracking-wider">
            Apuntá la cámara al QR
          </p>
          <div className="relative w-full max-w-xs">
            {/* Scanner container */}
            <div
              id="qr-reader"
              className="w-full rounded-2xl overflow-hidden shadow-xl"
            />
            {/* Corner overlays */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-[#ea7014] rounded-tl-lg pointer-events-none" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-[#ea7014] rounded-tr-lg pointer-events-none" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-[#ea7014] rounded-bl-lg pointer-events-none" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-[#ea7014] rounded-br-lg pointer-events-none" />
          </div>
          <button
            onClick={async () => {
              await stopScanner();
              setScanState("idle");
            }}
            className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors py-2 px-4"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* LOADING */}
      {scanState === "loading" && (
        <div className="flex flex-col items-center gap-4 mt-12">
          <div className="w-12 h-12 border-4 border-[#ea7014]/20 border-t-[#ea7014] rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Verificando...</p>
        </div>
      )}

      {/* RESULT */}
      {scanState === "result" && (
        <div className="flex flex-col items-center gap-5 w-full max-w-sm mx-auto">
          {/* Not found */}
          {notFound && (
            <div className="w-full bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 text-center">
              <p className="text-4xl mb-2">⚠️</p>
              <p className="text-xl font-black text-orange-600">
                NO ENCONTRADA
              </p>
              <p className="text-sm text-orange-500 mt-1">
                Este código no existe en el sistema.
              </p>
            </div>
          )}

          {/* Card found */}
          {card && !notFound && (
            <>
              {/* Status banner */}
              {card.status === "ACTIVE" ? (
                <div className="w-full bg-green-50 border-2 border-green-200 rounded-2xl p-5 text-center">
                  <p className="text-4xl mb-1">✅</p>
                  <p className="text-2xl font-black text-green-600">VÁLIDA</p>
                  <p className="text-sm text-green-500 mt-0.5">
                    Lista para canjear
                  </p>
                </div>
              ) : (
                <div className="w-full bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-center">
                  <p className="text-4xl mb-1">❌</p>
                  <p className="text-2xl font-black text-red-600">UTILIZADA</p>
                  {card.usedAt && (
                    <p className="text-sm text-red-400 mt-0.5">
                      Canjeada el{" "}
                      {new Date(card.usedAt).toLocaleDateString("es-AR")}
                    </p>
                  )}
                </div>
              )}

              {/* Card details */}
              <div className="w-full bg-white rounded-2xl border border-[#ea7014]/10 p-5 space-y-3 shadow-sm">
                <Row label="Destinatario" value={card.recipientName} />
                <Row
                  label="Valor"
                  value={card.isProduct ? card.amount : `$ ${card.amount}`}
                />
                <Row label="Fecha" value={card.date} />
                <Row label="Código" value={card.code} mono />
              </div>

              {/* Action: mark as used */}
              {card.status === "ACTIVE" && !actionDone && (
                <button
                  onClick={handleMarkUsed}
                  disabled={actionLoading}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-black text-base uppercase tracking-wider py-4 rounded-2xl shadow-lg transition-colors"
                >
                  {actionLoading ? "Procesando..." : "✓ Marcar como utilizada"}
                </button>
              )}

              {actionDone && (
                <div className="w-full bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-center">
                  <p className="text-green-700 font-black text-lg">
                    ✓ Marcada como utilizada
                  </p>
                </div>
              )}
            </>
          )}

          {/* Scan again */}
          <button
            onClick={startScanner}
            className="w-full bg-[#ea7014]/10 hover:bg-[#ea7014]/20 text-[#ea7014] font-black text-sm uppercase tracking-wider py-3.5 rounded-2xl transition-colors"
          >
            Escanear otro QR
          </button>
        </div>
      )}

      {/* ERROR */}
      {scanState === "error" && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-4xl">🚫</p>
          <p className="text-gray-600 font-medium text-center">
            No se pudo acceder a la cámara. Verificá los permisos del navegador.
          </p>
          <button
            onClick={() => setScanState("idle")}
            className="bg-[#ea7014] text-white font-bold py-3 px-8 rounded-xl transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}
    </main>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-xs font-bold text-[#ea7014]/50 uppercase tracking-wide shrink-0">
        {label}
      </span>
      <span
        className={`text-sm font-semibold text-gray-800 text-right ${mono ? "font-mono tracking-wider" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
