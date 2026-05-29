import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const giftCard = await prisma.giftCard.findUnique({ where: { code } });
    if (!giftCard) {
      return NextResponse.json(
        { success: false, error: "Gift card no encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: giftCard });
  } catch (error) {
    console.error("Error consultando gift card:", error);
    return NextResponse.json(
      { success: false, error: "Error al consultar la gift card" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { status, redeemedByName, redeemedByDni } = body;

    const isUsed = status === "USED";

    if (isUsed) {
      const name = typeof redeemedByName === "string" ? redeemedByName.trim() : "";
      const dni = typeof redeemedByDni === "string" ? redeemedByDni.trim() : "";
      if (!name || !dni) {
        return NextResponse.json(
          {
            success: false,
            error: "Faltan datos del retiro (nombre y DNI son obligatorios).",
          },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.giftCard.update({
      where: { code },
      data: {
        status,
        usedAt: isUsed ? new Date() : null,
        redeemedByName: isUsed
          ? (redeemedByName as string).trim()
          : null,
        redeemedByDni: isUsed ? (redeemedByDni as string).trim() : null,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error actualizando gift card:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar la gift card" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    await prisma.giftCard.delete({ where: { code } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando gift card:", error);
    return NextResponse.json(
      { success: false, error: "Error al eliminar la gift card" },
      { status: 500 },
    );
  }
}
