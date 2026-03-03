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
  nativeSize?: boolean;
}

const PHONE = "342 5162086";
const ADDRESS = "Rivadavia 2700";
const TERMS =
  "El cupón es válido ÚNICAMENTE para ser canjeado en el local de Carestino de la Ciudad de Santa Fe ubicado en Rivadavia 2700.";

const COLOR = "#ea7014";
const BG = "#FAF7F2";
const FONT = "var(--font-montserrat), Montserrat, Arial, sans-serif";

const GiftCard = forwardRef<HTMLDivElement, GiftCardProps>(
  ({ data, nativeSize = false }, ref) => {
    const { recipientName, amount, isProduct, date, securityCode } = data;

    // All sizes defined in "native" units (480px card), scaled for preview
    const s = nativeSize ? 1 : 0.79;
    const w = nativeSize ? 480 : 380;
    const px = nativeSize ? 48 : 32;
    const py = nativeSize ? 40 : 28;

    return (
      <div
        ref={ref}
        style={{
          width: `${w}px`,
          backgroundColor: BG,
          fontFamily: FONT,
          display: "flex",
          flexDirection: "column",
          paddingLeft: `${px}px`,
          paddingRight: `${px}px`,
          paddingTop: `${py}px`,
          paddingBottom: `${py}px`,
          userSelect: "none",
          boxSizing: "border-box",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: `${16 * s}px` }}>
          <div
            style={{
              color: COLOR,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              fontSize: `${68 * s}px`,
            }}
          >
            Carestino
          </div>
          <div
            style={{
              color: COLOR,
              fontWeight: 600,
              fontSize: `${21 * s}px`,
              marginTop: `${12 * s}px`,
            }}
          >
            Bebés Felices
          </div>
          <div
            style={{
              color: COLOR,
              fontWeight: 700,
              fontSize: `${15 * s}px`,
              marginTop: `${4 * s}px`,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Santa Fe
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: `1.5px solid ${COLOR}`,
            marginBottom: `${20 * s}px`,
          }}
        />

        {/* GIFT CARD */}
        <div style={{ textAlign: "center", marginBottom: `${8 * s}px` }}>
          <span
            style={{
              color: COLOR,
              fontWeight: 700,
              fontSize: `${24 * s}px`,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
            }}
          >
            GIFT CARD
          </span>
        </div>

        {/* Nombre */}
        <div style={{ textAlign: "center", marginBottom: `${16 * s}px` }}>
          <span
            style={{
              color: COLOR,
              fontWeight: 900,
              fontSize: `${30 * s}px`,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {recipientName || "NOMBRE"}
          </span>
        </div>

        {/* Monto / Producto */}
        <div style={{ textAlign: "center", marginBottom: `${16 * s}px` }}>
          {isProduct ? (
            <>
              <div
                style={{
                  color: COLOR,
                  fontWeight: 700,
                  fontSize: `${22 * s}px`,
                  marginBottom: `${4 * s}px`,
                }}
              >
                Vale por:
              </div>
              <div
                style={{
                  color: COLOR,
                  fontWeight: 900,
                  fontSize: `${34 * s}px`,
                }}
              >
                {amount || ""}
              </div>
            </>
          ) : (
            <div
              style={{ color: COLOR, fontWeight: 900, fontSize: `${44 * s}px` }}
            >
              $ {amount || ""}
            </div>
          )}
        </div>

        {/* Fecha */}
        <div style={{ textAlign: "center", marginBottom: `${32 * s}px` }}>
          <span
            style={{ color: COLOR, fontWeight: 700, fontSize: `${22 * s}px` }}
          >
            Fecha:{" "}
          </span>
          <span
            style={{ color: COLOR, fontWeight: 600, fontSize: `${22 * s}px` }}
          >
            {date || ""}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: `1px solid ${COLOR}`,
            marginBottom: `${16 * s}px`,
          }}
        />

        {/* Contacto — img con position:relative para alineación exacta en html2canvas */}
        <div
          style={{
            textAlign: "center",
            marginBottom: `${16 * s}px`,
            color: COLOR,
            fontWeight: 600,
            fontSize: `${17 * s}px`,
            lineHeight: `${26 * s}px`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            src="/phone-icon.svg"
            width={16 * s}
            height={16 * s}
            style={{
              display: "inline-block",
              position: "relative",
              top: `${4.5 * s}px`,
            }}
          />
          <span style={{ marginLeft: `${nativeSize ? 6 : 8}px` }}>{PHONE}</span>
          <span
            style={{
              opacity: 0.4,
              fontWeight: 300,
              fontSize: `${18 * s}px`,
              margin: `0 ${nativeSize ? 10 * s : 14}px`,
            }}
          >
            |
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            src="/location-icon.svg"
            width={16 * s}
            height={16 * s}
            style={{
              display: "inline-block",
              position: "relative",
              top: `${4.5 * s}px`,
            }}
          />
          <span style={{ marginLeft: `${nativeSize ? 6 : 8}px` }}>
            {ADDRESS}
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: `1px solid ${COLOR}`,
            marginBottom: `${16 * s}px`,
          }}
        />

        {/* Términos */}
        <div style={{ marginBottom: `${16 * s}px` }}>
          <p
            style={{
              color: COLOR,
              fontSize: `${13.5 * s}px`,
              lineHeight: 1.45,
              margin: 0,
            }}
          >
            <span style={{ fontWeight: 700 }}>Términos y Condiciones: </span>
            <span style={{ fontWeight: 500 }}>{TERMS}</span>
          </p>
        </div>

        {/* Código de seguridad */}
        {securityCode && (
          <div
            style={{
              marginTop: "auto",
              paddingTop: `${12 * s}px`,
              borderTop: "1px solid rgba(234,112,20,0.2)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <span
              style={{
                color: "rgba(234,112,20,0.75)",
                fontFamily: "monospace",
                fontWeight: 900,
                letterSpacing: "0.1em",
                fontSize: `${19 * s}px`,
              }}
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
