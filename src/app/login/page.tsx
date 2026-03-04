"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(from);
        router.refresh();
      } else {
        setError(json.error || "Error al iniciar sesión");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f4ef] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-[#ea7014] tracking-tight">
            Carestino
          </h1>
          <p className="text-[#ea7014]/60 font-semibold mt-1 text-sm uppercase tracking-wider">
            Gift Cards
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#ea7014]/10 p-8">
          <h2 className="text-lg font-black text-gray-800 mb-6 text-center">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[#ea7014] font-bold mb-1.5 text-xs uppercase tracking-wide">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario"
                required
                autoComplete="username"
                className="w-full border-2 border-[#ea7014]/40 rounded-lg px-4 py-3 text-gray-800 font-medium bg-white focus:outline-none focus:border-[#ea7014] focus:ring-2 focus:ring-[#ea7014]/20 transition placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-[#ea7014] font-bold mb-1.5 text-xs uppercase tracking-wide">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full border-2 border-[#ea7014]/40 rounded-lg px-4 py-3 text-gray-800 font-medium bg-white focus:outline-none focus:border-[#ea7014] focus:ring-2 focus:ring-[#ea7014]/20 transition placeholder-gray-400"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm font-semibold text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ea7014] hover:bg-[#d4620e] disabled:opacity-60 text-white font-black text-sm uppercase tracking-wider py-3.5 rounded-xl transition-colors shadow-md shadow-[#ea7014]/30 mt-2"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
