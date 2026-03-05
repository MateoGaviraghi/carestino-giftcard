import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cards = await prisma.giftCard.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: cards });
  } catch (error) {
    console.error("Error obteniendo gift cards:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener las gift cards" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, recipientName, amount, isProduct, date } = body;

    if (!code || !recipientName || !amount || !date) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    const giftCard = await prisma.giftCard.upsert({
      where: { code },
      update: {},
      create: {
        code,
        recipientName,
        amount,
        isProduct: isProduct ?? false,
        date,
      },
    });

    return NextResponse.json(
      { success: true, data: giftCard },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creando gift card:", error);
    return NextResponse.json(
      { success: false, error: "Error al guardar la gift card" },
      { status: 500 },
    );
  }
}
