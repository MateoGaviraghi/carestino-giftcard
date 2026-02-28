"use client";

import React, { forwardRef } from "react";

export interface GiftCardData {
  recipientName: string;
  amount: string;
  isProduct?: boolean;
  date: string;
  securityCode?: string;
}

interface GiftCardProps {
  data: GiftCardData;
  /** Cuando scale=true, la tarjeta usa su tamaño nativo (para la captura del PDF). */
  nativeSize?: boolean;
}

// Datos fijos del negocio
const PHONE = "342 5162086";
const ADDRESS = "Rivadavia 2700";
const TERMS =
  "El cupón es válido ÚNICAMENTE para ser canjeado en el local de Carestino de la Ciudad de Santa Fe ubicado en Rivadavia 2700.";

const GiftCard = forwardRef<HTMLDivElement, GiftCardProps>(
  ({ data, nativeSize = false }, ref) => {
    const { recipientName, amount, isProduct, date, securityCode } = data;

    const cardClass = nativeSize
      ? "w-[420px] min-h-[600px]"
      : "w-full max-w-[380px]";

    return (
      <div
        ref={ref}
        className={`${cardClass} bg-[#FAF7F2] flex flex-col px-8 py-7 select-none`}
        style={{ fontFamily: "var(--font-montserrat), Montserrat, sans-serif" }}
      >
        {/* ── Nombre ── */}
        <div className="text-center mb-2">
          <h2
            className="text-[#ea7014] font-black uppercase tracking-widest"
            style={{ fontSize: nativeSize ? "26px" : "clamp(18px, 4vw, 26px)" }}
          >
            {recipientName || "NOMBRE"}
          </h2>
        </div>

        {/* ── Divider ── */}
        <hr className="border-[#ea7014] border-t-[1.5px] mb-6" />

        {/* ── Logo ── */}
        <div className="text-center mb-1">
          <span
            className="text-[#ea7014] font-black leading-none tracking-tight block"
            style={{ fontSize: nativeSize ? "56px" : "clamp(38px, 8vw, 56px)" }}
          >
            Carestino
          </span>
          <span
            className="text-[#ea7014] font-semibold block mt-0.5"
            style={{
              fontSize: nativeSize ? "17px" : "clamp(13px, 2.5vw, 17px)",
            }}
          >
            Bebés Felices
          </span>
          <span
            className="text-[#ea7014] font-bold block mt-0.5 tracking-[0.22em] uppercase"
            style={{
              fontSize: nativeSize ? "13px" : "clamp(10px, 1.9vw, 13px)",
            }}
          >
            Santa Fe
          </span>
        </div>

        {/* ── Gift Card label ── */}
        <div className="text-center mt-5 mb-4">
          <span
            className="text-[#ea7014] font-bold uppercase tracking-[0.18em]"
            style={{ fontSize: nativeSize ? "20px" : "clamp(14px, 3vw, 20px)" }}
          >
            GIFT CARD
          </span>
        </div>

        {/* ── Monto / Producto ── */}
        <div className="text-center mb-3">
          {isProduct ? (
            <>
              <span
                className="text-[#ea7014] font-bold block mb-1"
                style={{ fontSize: nativeSize ? "18px" : "clamp(13px, 2.5vw, 18px)" }}
              >
                Vale por:
              </span>
              <span
                className="text-[#ea7014] font-black inline-block border-b-2 border-[#ea7014] pb-0.5 min-w-[200px]"
                style={{ fontSize: nativeSize ? "28px" : "clamp(18px, 4.5vw, 28px)" }}
              >
                {amount || ""}
              </span>
            </>
          ) : (
            <>
              <span
                className="text-[#ea7014] font-black"
                style={{ fontSize: nativeSize ? "36px" : "clamp(24px, 5.5vw, 36px)" }}
              >
                ${" "}
              </span>
              <span
                className="text-[#ea7014] font-black inline-block border-b-2 border-[#ea7014] pb-0.5 min-w-[120px]"
                style={{ fontSize: nativeSize ? "36px" : "clamp(24px, 5.5vw, 36px)" }}
              >
                {amount || ""}
              </span>
            </>
          )}
        </div>

        {/* ── Fecha ── */}
        <div className="text-center mb-6">
          <span
            className="text-[#ea7014] font-bold"
            style={{
              fontSize: nativeSize ? "18px" : "clamp(13px, 2.8vw, 18px)",
            }}
          >
            Fecha:{" "}
          </span>
          <span
            className="text-[#ea7014] font-semibold inline-block border-b-2 border-[#ea7014] pb-0.5 min-w-[100px] text-center"
            style={{
              fontSize: nativeSize ? "18px" : "clamp(13px, 2.8vw, 18px)",
            }}
          >
            {date || ""}
          </span>
        </div>

        {/* ── Divider ── */}
        <hr className="border-[#ea7014] border-t-[1px] mb-4" />

        {/* ── Contacto ── */}
        <div className="flex items-center justify-center gap-5 mb-4">
          <div className="flex items-center gap-1.5">
            {/* Phone icon */}
            <svg
              className="flex-shrink-0"
              width={nativeSize ? 18 : 16}
              height={nativeSize ? 18 : 16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ea7014"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.87a16 16 0 0 0 6.22 6.22l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span
              className="text-[#ea7014] font-semibold"
              style={{
                fontSize: nativeSize ? "15px" : "clamp(11px, 2.2vw, 15px)",
              }}
            >
              {PHONE}
            </span>
          </div>

          {/* Separador vertical */}
          <span className="text-[#ea7014] opacity-60 font-light">|</span>

          <div className="flex items-center gap-1.5">
            {/* Location icon */}
            <svg
              className="flex-shrink-0"
              width={nativeSize ? 16 : 14}
              height={nativeSize ? 16 : 14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ea7014"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span
              className="text-[#ea7014] font-semibold"
              style={{
                fontSize: nativeSize ? "15px" : "clamp(11px, 2.2vw, 15px)",
              }}
            >
              {ADDRESS}
            </span>
          </div>
        </div>

        {/* ── Divider ── */}
        <hr className="border-[#ea7014] border-t-[1px] mb-4" />

        {/* ── Términos ── */}
        <div className="mb-4">
          <p
            className="text-[#ea7014] leading-snug"
            style={{
              fontSize: nativeSize ? "11.5px" : "clamp(9px, 1.8vw, 11.5px)",
            }}
          >
            <span className="font-bold">Términos y Condiciones: </span>
            <span className="font-medium">{TERMS}</span>
          </p>
        </div>

        {/* ── Código de seguridad ── */}
        {securityCode && (
          <div className="mt-auto pt-3 border-t border-[#ea7014]/20 flex flex-col items-center">
            <span
              className="text-[#ea7014]/40 font-semibold uppercase tracking-wide"
              style={{ fontSize: nativeSize ? "9px" : "8px" }}
            >
              Código de seguridad
            </span>
            <span
              className="text-[#ea7014] opacity-70 font-mono font-black tracking-widest"
              style={{ fontSize: nativeSize ? "15px" : "13px" }}
            >
              {securityCode}
            </span>
          </div>
        )}
      </div>
    );
  },
);

GiftCard.displayName = "GiftCard";

export default GiftCard;
