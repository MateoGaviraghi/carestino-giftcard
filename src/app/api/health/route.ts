import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Nunca cachear: el punto de este endpoint es el estado de AHORA.
export const dynamic = "force-dynamic";

/**
 * Ping a la base. Lo usa la pantalla de generacion para avisar que la base no
 * responde ANTES de que se carguen los datos de una gift card con el cliente enfrente.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ success: true, db: "up" });
  } catch (error) {
    console.error("Health check: la base no responde:", error);
    return NextResponse.json(
      { success: false, db: "down" },
      { status: 503 },
    );
  }
}
