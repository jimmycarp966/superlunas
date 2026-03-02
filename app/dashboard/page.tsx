"use client";

import { useEffect, useState } from "react";
import { Activity, CreditCard, Package, Users } from "lucide-react";

interface DashboardSummary {
    productos: number;
    clientes: number;
    creditosPendientesAuditoria: number;
    creditosPendientesEncargado: number;
    creditosPendientesRepartidor: number;
    cobranzasPendientes: number;
    pagosAcumulados: number;
}

const formatARS = (value: number): string => Math.round(value || 0).toLocaleString("es-AR");

export default function DashboardPage() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch("/api/dashboard/summary", { cache: "no-store" });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    setError(json.error || "No se pudo cargar dashboard.");
                    return;
                }
                setSummary(json.data);
            } catch {
                setError("Error de red al cargar dashboard.");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    return (
        <main className="min-h-screen bg-[#f5f6f8] text-slate-800 px-3 sm:px-6 py-6">
            <div className="max-w-6xl mx-auto space-y-5">
                <header className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-black text-[#db1818]">Dashboard Ejecutivo</h1>
                        <p className="text-sm text-slate-600">Resumen operativo del ERP Lunas Confort</p>
                    </div>
                    <a
                        href="/cotizador"
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold"
                    >
                        Volver
                    </a>
                </header>

                {loading && (
                    <div className="rounded-xl bg-white border border-slate-200 p-4 text-sm text-slate-500">
                        Cargando dashboard...
                    </div>
                )}
                {error && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {!loading && !error && summary && (
                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <article className="rounded-xl bg-white border border-slate-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Productos</p>
                            <p className="text-2xl font-black text-slate-900">{summary.productos}</p>
                            <Package className="w-4 h-4 text-[#db1818]" />
                        </article>
                        <article className="rounded-xl bg-white border border-slate-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Clientes</p>
                            <p className="text-2xl font-black text-slate-900">{summary.clientes}</p>
                            <Users className="w-4 h-4 text-[#db1818]" />
                        </article>
                        <article className="rounded-xl bg-white border border-slate-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Cobranzas pendientes</p>
                            <p className="text-2xl font-black text-slate-900">{summary.cobranzasPendientes}</p>
                            <Activity className="w-4 h-4 text-[#db1818]" />
                        </article>
                        <article className="rounded-xl bg-white border border-slate-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Tesoreria acumulada</p>
                            <p className="text-2xl font-black text-slate-900">$ {formatARS(summary.pagosAcumulados)}</p>
                            <CreditCard className="w-4 h-4 text-[#db1818]" />
                        </article>

                        <article className="rounded-xl bg-amber-50 border border-amber-200 p-4 sm:col-span-2">
                            <p className="text-xs uppercase tracking-wide text-amber-700">Creditos - etapa auditor</p>
                            <p className="text-2xl font-black text-amber-900">{summary.creditosPendientesAuditoria}</p>
                        </article>
                        <article className="rounded-xl bg-sky-50 border border-sky-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-sky-700">Etapa encargado</p>
                            <p className="text-2xl font-black text-sky-900">{summary.creditosPendientesEncargado}</p>
                        </article>
                        <article className="rounded-xl bg-violet-50 border border-violet-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-violet-700">Etapa repartidor</p>
                            <p className="text-2xl font-black text-violet-900">{summary.creditosPendientesRepartidor}</p>
                        </article>
                    </section>
                )}
            </div>
        </main>
    );
}

