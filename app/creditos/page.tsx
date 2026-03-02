"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileSearch, Truck, UserCheck, XCircle } from "lucide-react";

type CreditoEstado =
    | "pendiente_auditoria"
    | "pendiente_encargado"
    | "pendiente_repartidor"
    | "aprobado"
    | "rechazado";

interface CreditoItem {
    id: string;
    cliente: string;
    dni: string;
    vendedor: string;
    zona: string;
    total: number;
    estado: CreditoEstado;
    informeComercialUrl?: string | null;
    observaciones?: string | null;
    creadoAt: string;
    actualizadoAt: string;
}

interface SessionInfo {
    role: string;
    username?: string;
    nombre?: string;
}

const statusLabel: Record<CreditoEstado, string> = {
    pendiente_auditoria: "Pendiente Auditor",
    pendiente_encargado: "Pendiente Encargado",
    pendiente_repartidor: "Pendiente Repartidor",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
};

const statusClass: Record<CreditoEstado, string> = {
    pendiente_auditoria: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    pendiente_encargado: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    pendiente_repartidor: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    aprobado: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    rechazado: "bg-red-500/15 text-red-200 border-red-500/30",
};

const stageIcon = (estado: CreditoEstado) => {
    if (estado === "pendiente_auditoria") return <FileSearch className="w-4 h-4" />;
    if (estado === "pendiente_encargado") return <UserCheck className="w-4 h-4" />;
    if (estado === "pendiente_repartidor") return <Truck className="w-4 h-4" />;
    if (estado === "aprobado") return <CheckCircle2 className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
};

const canResolve = (role: string, estado: CreditoEstado): boolean => {
    if (role === "admin" || role === "gerente") return true;
    if (estado === "pendiente_auditoria") return role === "auditor";
    if (estado === "pendiente_encargado") return role === "encargado_cobranza";
    if (estado === "pendiente_repartidor") return role === "repartidor";
    return false;
};

const formatARS = (value: number): string => {
    return Math.round(value || 0).toLocaleString("es-AR");
};

const formatDate = (iso: string): string => {
    try {
        return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    } catch {
        return iso;
    }
};

export default function CreditosPage() {
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [creditos, setCreditos] = useState<CreditoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState("");

    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            const [meRes, credRes] = await Promise.all([
                fetch("/api/auth/me", { cache: "no-store" }),
                fetch("/api/creditos", { cache: "no-store" }),
            ]);
            const meJson = await meRes.json();
            const credJson = await credRes.json();

            if (!meRes.ok || !meJson.success) {
                setError(meJson.error || "No se pudo obtener la sesion.");
                return;
            }
            setSession(meJson.data);

            if (!credRes.ok || !credJson.success) {
                setError(credJson.error || "No se pudieron cargar los creditos.");
                return;
            }
            setCreditos(Array.isArray(credJson.data) ? credJson.data : []);
        } catch {
            setError("Error de red al cargar creditos.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, []);

    const resumen = useMemo(() => {
        return {
            total: creditos.length,
            pendientes: creditos.filter((c) => c.estado.startsWith("pendiente")).length,
            aprobados: creditos.filter((c) => c.estado === "aprobado").length,
            rechazados: creditos.filter((c) => c.estado === "rechazado").length,
        };
    }, [creditos]);

    const resolver = async (credito: CreditoItem, approve: boolean) => {
        const comentario = window.prompt(
            approve ? "Comentario de aprobacion (opcional):" : "Motivo de rechazo (obligatorio):",
            "",
        );
        if (!approve && !String(comentario ?? "").trim()) return;

        setSavingId(credito.id);
        try {
            const res = await fetch(`/api/creditos/${credito.id}/resolver`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approve,
                    comentario: comentario ?? "",
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                window.alert(json.error || "No se pudo resolver la solicitud.");
                return;
            }

            setCreditos((prev) =>
                prev.map((item) => (item.id === credito.id ? json.data : item))
            );
        } catch {
            window.alert("Error de red al resolver la solicitud.");
        } finally {
            setSavingId(null);
        }
    };

    return (
        <main className="min-h-screen bg-[#0a1220] text-slate-200 px-3 sm:px-6 py-6">
            <div className="max-w-6xl mx-auto space-y-5">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-white">Flujo de Creditos</h1>
                        <p className="text-sm text-slate-400">
                            Pipeline interno: Auditor - Encargado Cobranza - Repartidor.
                        </p>
                    </div>
                    <a
                        href="/cotizador"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                    >
                        Volver a Cotizador
                    </a>
                </header>

                <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                        <p className="text-xl font-black text-white">{resumen.total}</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-amber-200">Pendientes</p>
                        <p className="text-xl font-black text-amber-100">{resumen.pendientes}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-emerald-200">Aprobados</p>
                        <p className="text-xl font-black text-emerald-100">{resumen.aprobados}</p>
                    </div>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-red-200">Rechazados</p>
                        <p className="text-xl font-black text-red-100">{resumen.rechazados}</p>
                    </div>
                </section>

                {loading && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
                        Cargando creditos...
                    </div>
                )}

                {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {!loading && !error && creditos.length === 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-8 text-sm text-slate-400 text-center">
                        No hay solicitudes de credito para mostrar.
                    </div>
                )}

                {!loading && !error && creditos.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {creditos.map((credito) => (
                            <article
                                key={credito.id}
                                className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-base font-black text-white">{credito.cliente}</h2>
                                        <p className="text-xs text-slate-400">
                                            DNI {credito.dni || "-"} - Vendedor {credito.vendedor || "-"}
                                        </p>
                                    </div>
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusClass[credito.estado]}`}
                                    >
                                        {stageIcon(credito.estado)}
                                        {statusLabel[credito.estado]}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2">
                                        <p className="text-[11px] uppercase text-slate-500">Zona</p>
                                        <p className="text-slate-100 font-semibold">{credito.zona || "-"}</p>
                                    </div>
                                    <div className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2">
                                        <p className="text-[11px] uppercase text-slate-500">Total</p>
                                        <p className="text-slate-100 font-semibold">$ {formatARS(credito.total)}</p>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500">
                                    <p>Alta: {formatDate(credito.creadoAt)}</p>
                                    <p>Actualizado: {formatDate(credito.actualizadoAt)}</p>
                                </div>

                                {credito.informeComercialUrl && (
                                    <a
                                        href={credito.informeComercialUrl}
                                        target="_blank"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-sky-200"
                                    >
                                        Ver informe comercial
                                    </a>
                                )}

                                {credito.observaciones && (
                                    <p className="text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                                        {credito.observaciones}
                                    </p>
                                )}

                                {session && canResolve(session.role, credito.estado) && (
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => resolver(credito, true)}
                                            disabled={savingId === credito.id}
                                            className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
                                        >
                                            {savingId === credito.id ? "Guardando..." : "Aprobar etapa"}
                                        </button>
                                        <button
                                            onClick={() => resolver(credito, false)}
                                            disabled={savingId === credito.id}
                                            className="flex-1 px-3 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white"
                                        >
                                            Rechazar
                                        </button>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}

                <footer className="text-[11px] text-slate-500 flex items-center gap-2">
                    <Clock3 className="w-3.5 h-3.5" />
                    El credito solo queda aprobado despues de las 3 validaciones internas.
                </footer>
            </div>
        </main>
    );
}

