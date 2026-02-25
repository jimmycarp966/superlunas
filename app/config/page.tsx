"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Settings } from "lucide-react";

export default function AdminLoginPage() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password, role: "admin" }),
            });

            if (res.ok) {
                router.push("/config/panel");
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || "Password incorrecta");
            }
        } catch (err) {
            setError("Fallo la conexión con el servidor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-neutral-900 flex items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-sm bg-neutral-800 rounded-2xl shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)] border border-neutral-700 overflow-hidden">
                <div className="px-5 sm:px-6 py-7 sm:py-8 text-center bg-gradient-to-br from-neutral-800 to-neutral-700 border-b border-neutral-700">
                    <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                        <Settings className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                        Administración
                    </h1>
                    <p className="text-neutral-400 text-sm">
                        Panel de Configuración Lunas Confort
                    </p>
                </div>

                <form onSubmit={handleLogin} className="px-5 sm:px-6 py-7 sm:py-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-neutral-300 mb-1.5"
                            >
                                Contraseña Admin
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <ShieldCheck className="h-4 w-4 text-neutral-500" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                                    placeholder="Ingrese contraseña de administrador"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm font-medium text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-500/20">
                                {error}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full relative group bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 overflow-hidden"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Acceder al Panel"
                            )}
                        </span>
                    </button>
                </form>
            </div>
        </main>
    );
}
