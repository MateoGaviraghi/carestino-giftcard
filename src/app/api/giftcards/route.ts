import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Solo para el admin: nunca se imprime en la gift card.
const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD"];

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
    const { code, recipientName, amount, isProduct, date, paymentMethod } = body;

    if (!code || !recipientName || !amount || !date) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios" },
        { status: 400 },
      );
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: "Medio de pago inválido" },
        { status: 400 },
      );
    }

    try {
      const giftCard = await prisma.giftCard.create({
        data: {
          code,
          recipientName,
          amount,
          isProduct: isProduct ?? false,
          date,
          paymentMethod,
        },
      });

      return NextResponse.json({ success: true, data: giftCard }, { status: 201 });
    } catch (error) {
      // P2002 = violacion de unique. El codigo ya existe, y hay dos motivos posibles.
      if ((error as { code?: string })?.code !== "P2002") throw error;

      const existing = await prisma.giftCard.findUnique({ where: { code } });

      // (a) Es un reintento del MISMO alta (la primera pudo cortarse despues de
      //     escribir). Los datos coinciden, asi que ya esta persistida: exito.
      const sameCard =
        existing !== null &&
        existing.recipientName === recipientName &&
        existing.amount === amount &&
        existing.isProduct === (isProduct ?? false) &&
        existing.date === date &&
        existing.paymentMethod === paymentMethod;

      if (sameCard) {
        return NextResponse.json({ success: true, data: existing }, { status: 200 });
      }

      // (b) Colision real: ese codigo ya pertenece a OTRA gift card. Antes esto
      //     se tapaba con un upsert de update vacio, que devolvia 201 sin escribir
      //     nada y dejaba la gift card nueva sin registro. Ahora el cliente recibe
      //     409 y reintenta con un codigo nuevo.
      console.error(
        `Colision de codigo ${code}: ya pertenece a otra gift card (${existing?.recipientName}).`,
      );
      return NextResponse.json(
        { success: false, error: "CODE_COLLISION" },
        { status: 409 },
      );
    }
  } catch (error) {
    console.error("Error creando gift card:", error);
    return NextResponse.json(
      { success: false, error: "Error al guardar la gift card" },
      { status: 500 },
    );
  }
}
