"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Intentar como vendedor primero
            let res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, role: "vendor" }),
            });

            if (res.ok) {
                router.push("/cotizador");
                router.refresh();
                return;
            }

            // Intentar como admin
            res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, role: "admin" }),
            });

            if (res.ok) {
                router.push("/config/panel");
                router.refresh();
                return;
            }

            setError("Clave incorrecta");
        } catch {
            setError("Fallo la conexión con el servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-black flex items-center justify-center p-3 sm:p-4">
            {/* Tarjeta de login */}
            <div className="w-full max-w-sm bg-[#0d0d1a] rounded-2xl shadow-2xl border border-[#2a2a4a] overflow-hidden">
                {/* Cabecera con logo */}
                <div className="px-5 sm:px-6 pt-7 sm:pt-8 pb-5 sm:pb-6 text-center border-b border-[#2a2a4a]">
                    <div className="text-center mb-3">
                        <h1 className="text-[26px] sm:text-3xl font-extrabold text-white tracking-widest uppercase" style={{ WebkitTextStroke: '1px #f97316' }}>
                            <span className="text-yellow-400 text-[42px] sm:text-5xl inline-block -mr-2">C</span>
                            <span className="text-red-500">L</span>UNA&apos;S
                            <br />
                            <span className="text-red-500">C</span>ONFORT
                        </h1>
                        <p className="text-red-500 font-bold text-xs uppercase tracking-widest mt-1">15 años juntos</p>
                        <p className="text-red-600 font-bold text-[10px] uppercase tracking-wider">Todo para su hogar y comercio</p>
                    </div>
                </div>

                {/* Formulario */}
                <form onSubmit={handleLogin} className="px-5 sm:px-6 py-7 sm:py-8 space-y-5">
                    <h2 className="text-white font-bold text-xl text-center tracking-wider uppercase">
                        Acceso Sistema
                    </h2>

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Ingresa tu clave..."
                        autoFocus
                        className="block w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors text-center"
                    />

                    {error && (
                        <p className="text-sm font-medium text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-500/20 text-center">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 uppercase tracking-widest text-sm"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                Ingresando...
                            </span>
                        ) : (
                            "ENTRAR AL SISTEMA"
                        )}
                    </button>
                </form>
            </div>

            {/* Watermark esquina inferior derecha */}
            <div className="fixed bottom-4 right-4 opacity-20 pointer-events-none select-none">
                <div className="text-center">
                    <span className="text-white font-extrabold text-sm tracking-widest uppercase">
                        <span className="text-yellow-400">C</span>
                        <span className="text-red-500">L</span>UNA&apos;S <span className="text-red-500">C</span>ONFORT
                    </span>
                </div>
            </div>
        </main>
    );
}
