import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Nunca cachear: el punto de este endpoint es el estado de AHORA.
export const dynamic = "force-dynamic";

// Neon suspende el compute cuando nadie lo usa. Despertarlo puede tardar varios
// segundos, asi que la funcion necesita margen para no cortarse en el intento.
export const maxDuration = 30;

/**
 * Ping a la base. Lo usa la pantalla de generacion para avisar que la base no
 * responde ANTES de que se carguen los datos de una gift card con el cliente enfrente.
 *
 * Reintenta: un solo fallo NO alcanza para declarar la base caida. El primer
 * ping del dia es justamente el que dispara el wake-up de Neon y suele morir
 * en el camino aunque la base este perfectamente sana.
 */
export async function GET() {
  let ultimoError: unknown = null;

  for (let intento = 1; intento <= 2; intento++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({ success: true, db: "up" });
    } catch (error) {
      ultimoError = error;
      if (intento < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.error("Health check: la base no responde:", ultimoError);
  return NextResponse.json({ success: false, db: "down" }, { status: 503 });
}
