import { prisma } from "@/lib/prisma";

interface VerifyPageProps {
  params: Promise<{ code: string }>;
}

type CardStatus = "ACTIVE" | "USED" | "CANCELLED";

const statusConfig: Record<
  CardStatus,
  {
    emoji: string;
    label: string;
    color: string;
    bg: string;
    border: string;
    message: string;
  }
> = {
  ACTIVE: {
    emoji: "✅",
    label: "VÁLIDA",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    message: "Esta gift card está activa y lista para canjear.",
  },
  USED: {
    emoji: "❌",
    label: "UTILIZADA",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    message: "Esta gift card ya fue utilizada.",
  },
  CANCELLED: {
    emoji: "⛔",
    label: "CANCELADA",
    color: "#9ca3af",
    bg: "#f9fafb",
    border: "#e5e7eb",
    message: "Esta gift card fue cancelada.",
  },
};

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { code } = await params;

  let giftCard = null;
  let error = false;

  try {
    giftCard = await prisma.giftCard.findUnique({ where: { code } });
  } catch {
    error = true;
  }

  const status = giftCard ? statusConfig[giftCard.status as CardStatus] : null;

  return (
    <main className="min-h-screen bg-[#f8f4ef] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-[#ea7014]">Carestino</h1>
          <p className="text-[#ea7014]/60 font-semibold text-sm uppercase tracking-wider mt-1">
            Verificación de Gift Card
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#ea7014]/10 p-8">
          {error && (
            <div className="text-center">
              <p className="text-2xl mb-2">⚠️</p>
              <p className="text-gray-500 font-medium">
                Ocurrió un error al verificar. Intentá de nuevo.
              </p>
            </div>
          )}

          {!error && !giftCard && (
            <div className="text-center">
              <p className="text-4xl mb-4">🔍</p>
              <h2 className="text-xl font-black text-gray-800 mb-2">
                Código no encontrado
              </h2>
              <p className="text-gray-500">
                El código{" "}
                <span className="font-mono font-bold text-[#ea7014]">
                  {code}
                </span>{" "}
                no existe en nuestro sistema.
              </p>
            </div>
          )}

          {!error && giftCard && status && (
            <div>
              {/* Status badge */}
              <div
                className="rounded-xl p-4 mb-6 text-center border-2"
                style={{
                  backgroundColor: status.bg,
                  borderColor: status.border,
                }}
              >
                <p className="text-4xl mb-1">{status.emoji}</p>
                <p
                  className="text-xl font-black"
                  style={{ color: status.color }}
                >
                  {status.label}
                </p>
                <p className="text-sm mt-1" style={{ color: status.color }}>
                  {status.message}
                </p>
              </div>

              {/* Gift card details */}
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm font-medium">
                    Destinatario
                  </span>
                  <span className="font-bold text-gray-800">
                    {giftCard.recipientName}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm font-medium">
                    {giftCard.isProduct ? "Producto" : "Monto"}
                  </span>
                  <span className="font-bold text-[#ea7014]">
                    {giftCard.isProduct
                      ? giftCard.amount
                      : `$ ${giftCard.amount}`}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm font-medium">
                    Fecha de emisión
                  </span>
                  <span className="font-bold text-gray-800">
                    {giftCard.date}
                  </span>
                </div>
                {giftCard.status === "USED" && giftCard.usedAt && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500 text-sm font-medium">
                      Utilizada el
                    </span>
                    <span className="font-bold text-red-600">
                      {new Date(giftCard.usedAt).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                )}
                <div className="pt-3 text-center">
                  <span className="font-mono text-xs text-gray-400 tracking-wider">
                    {giftCard.code}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Carestino Bebés Felices · Rivadavia 2700, Santa Fe
        </p>
      </div>
    </main>
  );
}
