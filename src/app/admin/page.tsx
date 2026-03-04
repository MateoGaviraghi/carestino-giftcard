"use client";

import { useEffect, useState, useCallback } from "react";

interface GiftCard {
  id: string;
  code: string;
  recipientName: string;
  amount: string;
  isProduct: boolean;
  date: string;
  status: "ACTIVE" | "USED";
  createdAt: string;
  usedAt: string | null;
}

const STATUS_LABEL: Record<GiftCard["status"], string> = {
  ACTIVE: "Activa",
  USED: "Utilizada",
};

const STATUS_COLOR: Record<GiftCard["status"], string> = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  USED: "bg-red-100 text-red-600 border-red-200",
};

export default function AdminPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/giftcards");
      const json = await res.json();
      if (json.success) setCards(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleStatusChange = async (
    code: string,
    status: GiftCard["status"],
  ) => {
    setActionLoading(code + status);
    try {
      await fetch(`/api/giftcards/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await fetchCards();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`¿Seguro que querés eliminar la gift card ${code}?`)) return;
    setActionLoading(code + "delete");
    try {
      await fetch(`/api/giftcards/${code}`, { method: "DELETE" });
      await fetchCards();
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = cards.filter((c) => {
    const matchSearch =
      search === "" ||
      c.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: cards.length,
    active: cards.filter((c) => c.status === "ACTIVE").length,
    used: cards.filter((c) => c.status === "USED").length,
  };

  return (
    <main className="min-h-screen bg-[#f8f4ef] py-10 px-4">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8">
        <h1 className="text-3xl font-black text-[#ea7014]">Carestino</h1>
        <p className="text-[#ea7014]/60 font-semibold text-sm uppercase tracking-wider">
          Panel de Gift Cards
        </p>
      </header>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: counts.total, color: "text-[#ea7014]" },
            { label: "Activas", value: counts.active, color: "text-green-600" },
            { label: "Utilizadas", value: counts.used, color: "text-red-500" },
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

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#ea7014]/10 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 font-medium">
              Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 font-medium">
              No hay gift cards
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#ea7014]/5 border-b border-[#ea7014]/10">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-[#ea7014] uppercase tracking-wide text-xs">
                      Código
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-[#ea7014] uppercase tracking-wide text-xs">
                      Destinatario
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-[#ea7014] uppercase tracking-wide text-xs">
                      Monto / Producto
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-[#ea7014] uppercase tracking-wide text-xs">
                      Fecha
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-[#ea7014] uppercase tracking-wide text-xs">
                      Estado
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-[#ea7014] uppercase tracking-wide text-xs">
                      Acciones
                    </th>
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
                          {card.isProduct ? card.amount : `$ ${card.amount}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{card.date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block border rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOR[card.status]}`}
                        >
                          {STATUS_LABEL[card.status]}
                        </span>
                        {card.status === "USED" && card.usedAt && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(card.usedAt).toLocaleDateString("es-AR")}
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
                              disabled={actionLoading === card.code + "ACTIVE"}
                              className="bg-[#ea7014] hover:bg-[#d4620e] disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Reactivar
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(card.code)}
                            disabled={actionLoading === card.code + "delete"}
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
          )}
        </div>
      </div>
    </main>
  );
}
