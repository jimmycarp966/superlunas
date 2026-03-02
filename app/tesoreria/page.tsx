"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeDollarSign, CalendarClock, RefreshCw } from "lucide-react";

interface PagoTesoreria {
    id: string;
    cliente: string;
    dni: string;
    monto: number;
    monto_esperado: number;
    fecha_imputacion: string;
    fecha_deuda_objetivo: string;
    medio_pago: string;
    conciliado: boolean;
    registrado_por?: string | null;
    observaciones?: string | null;
}

interface SessionInfo {
    role: string;
    username?: string;
    nombre?: string;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const formatARS = (value: number): string => Math.round(value || 0).toLocaleString("es-AR");
const canOverrideByRole = (role: string | null | undefined): boolean => {
    return role === "admin" || role === "gerente" || role === "contador";
};

export default function TesoreriaPage() {
    const [cliente, setCliente] = useState("");
    const [dni, setDni] = useState("");
    const [monto, setMonto] = useState("");
    const [montoEsperado, setMontoEsperado] = useState("");
    const [fechaImputacion, setFechaImputacion] = useState(todayIso());
    const [fechaDeudaObjetivo, setFechaDeudaObjetivo] = useState(todayIso());
    const [medioPago, setMedioPago] = useState("efectivo");
    const [observaciones, setObservaciones] = useState("");
    const [allowDifference, setAllowDifference] = useState(false);
    const [allowOverpay, setAllowOverpay] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [pagos, setPagos] = useState<PagoTesoreria[]>([]);
    const [loadingPagos, setLoadingPagos] = useState(true);
    const canOverrideRules = canOverrideByRole(session?.role);

    const fetchPagos = async () => {
        setLoadingPagos(true);
        try {
            const [meRes, pagosRes] = await Promise.all([
                fetch("/api/auth/me", { cache: "no-store" }),
                fetch("/api/tesoreria/pagos", { cache: "no-store" }),
            ]);

            const meJson = await meRes.json();
            if (meRes.ok && meJson.success) {
                setSession(meJson.data as SessionInfo);
            }

            const pagosJson = await pagosRes.json();
            if (pagosRes.ok && pagosJson.success) {
                setPagos(Array.isArray(pagosJson.data) ? pagosJson.data : []);
            } else {
                setError(pagosJson.error || "No se pudo cargar tesoreria.");
            }
        } finally {
            setLoadingPagos(false);
        }
    };

    useEffect(() => {
        void fetchPagos();
    }, []);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch("/api/tesoreria/pagos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cliente,
                    dni,
                    monto: Number(monto),
                    montoEsperado: Number(montoEsperado),
                    fechaImputacion,
                    fechaDeudaObjetivo,
                    medioPago,
                    observaciones,
                    allowDifference,
                    allowOverpay,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setError(json.error || "No se pudo registrar el pago.");
                return;
            }

            setSuccess("Pago registrado correctamente.");
            setMonto("");
            setMontoEsperado("");
            setObservaciones("");
            setAllowDifference(false);
            setAllowOverpay(false);
            await fetchPagos();
        } catch {
            setError("Error de red al registrar pago.");
        } finally {
            setLoading(false);
        }
    };

    const resumen = useMemo(() => {
        const total = pagos.reduce((acc, p) => acc + Number(p.monto || 0), 0);
        const conciliados = pagos.filter((p) => p.conciliado).length;
        const noConciliados = pagos.length - conciliados;
        return { total, conciliados, noConciliados };
    }, [pagos]);

    return (
        <main className="min-h-screen bg-[#0a1220] text-slate-200 px-3 sm:px-6 py-6">
            <div className="max-w-6xl mx-auto space-y-5">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-white">Tesoreria</h1>
                        <p className="text-sm text-slate-400">
                            Reglas activas: bloqueo fin de semana, no retroactivos y control de diferencias.
                        </p>
                    </div>
                    <a
                        href="/cotizador"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                    >
                        Volver
                    </a>
                </header>

                <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Total registrado</p>
                        <p className="text-xl font-black text-emerald-300">$ {formatARS(resumen.total)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-emerald-200">Conciliados</p>
                        <p className="text-xl font-black text-emerald-100">{resumen.conciliados}</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-amber-200">Con diferencia</p>
                        <p className="text-xl font-black text-amber-100">{resumen.noConciliados}</p>
                    </div>
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <h2 className="text-base font-black text-white mb-3">Registrar pago</h2>
                    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            type="text"
                            placeholder="Cliente"
                            value={cliente}
                            onChange={(e) => setCliente(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                            required
                        />
                        <input
                            type="text"
                            placeholder="DNI"
                            value={dni}
                            onChange={(e) => setDni(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        />
                        <select
                            value={medioPago}
                            onChange={(e) => setMedioPago(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        >
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="debito">Debito</option>
                            <option value="credito">Credito</option>
                            <option value="otro">Otro</option>
                        </select>

                        <input
                            type="number"
                            placeholder="Monto imputado"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                            required
                        />
                        <input
                            type="number"
                            placeholder="Monto esperado"
                            value={montoEsperado}
                            onChange={(e) => setMontoEsperado(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                            required
                        />
                        <input
                            type="text"
                            placeholder="Observaciones"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        />

                        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                            <CalendarClock className="w-4 h-4 text-slate-500" />
                            Fecha imputacion
                            <input
                                type="date"
                                value={fechaImputacion}
                                onChange={(e) => setFechaImputacion(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                                required
                            />
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                            <BadgeDollarSign className="w-4 h-4 text-slate-500" />
                            Fecha deuda objetivo
                            <input
                                type="date"
                                value={fechaDeudaObjetivo}
                                onChange={(e) => setFechaDeudaObjetivo(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                                required
                            />
                        </label>
                        <div className="flex flex-col justify-center gap-1 text-xs text-slate-300">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={allowDifference}
                                    onChange={(e) => setAllowDifference(e.target.checked)}
                                    disabled={!canOverrideRules}
                                    className="accent-amber-500"
                                />
                                Permitir diferencia de monto
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={allowOverpay}
                                    onChange={(e) => setAllowOverpay(e.target.checked)}
                                    disabled={!canOverrideRules}
                                    className="accent-amber-500"
                                />
                                Permitir sobrepago
                            </label>
                            {!canOverrideRules && (
                                <p className="text-[11px] text-slate-500">
                                    Solo admin, gerente o contador pueden habilitar excepciones.
                                </p>
                            )}
                        </div>

                        <div className="md:col-span-3 flex items-center gap-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold"
                            >
                                {loading ? "Guardando..." : "Registrar pago"}
                            </button>
                            <button
                                type="button"
                                onClick={fetchPagos}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-900 text-sm font-semibold"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Recargar lista
                            </button>
                        </div>
                    </form>

                    {error && (
                        <p className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 inline-flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {error}
                        </p>
                    )}
                    {success && (
                        <p className="mt-3 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                            {success}
                        </p>
                    )}
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <h2 className="text-base font-black text-white mb-3">Ultimos pagos</h2>
                    {loadingPagos ? (
                        <p className="text-sm text-slate-400">Cargando pagos...</p>
                    ) : pagos.length === 0 ? (
                        <p className="text-sm text-slate-400">No hay pagos registrados.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-400 border-b border-slate-800">
                                        <th className="py-2 pr-3">Cliente</th>
                                        <th className="py-2 pr-3">Monto</th>
                                        <th className="py-2 pr-3">Esperado</th>
                                        <th className="py-2 pr-3">Imputacion</th>
                                        <th className="py-2 pr-3">Deuda</th>
                                        <th className="py-2 pr-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagos.map((pago) => (
                                        <tr key={pago.id} className="border-b border-slate-800/70">
                                            <td className="py-2 pr-3 text-slate-100">{pago.cliente}</td>
                                            <td className="py-2 pr-3 text-emerald-300">$ {formatARS(pago.monto)}</td>
                                            <td className="py-2 pr-3 text-slate-200">$ {formatARS(pago.monto_esperado)}</td>
                                            <td className="py-2 pr-3 text-slate-300">{pago.fecha_imputacion}</td>
                                            <td className="py-2 pr-3 text-slate-300">{pago.fecha_deuda_objetivo}</td>
                                            <td className="py-2 pr-3">
                                                <span
                                                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                                                        pago.conciliado
                                                            ? "bg-emerald-500/20 text-emerald-200"
                                                            : "bg-amber-500/20 text-amber-200"
                                                    }`}
                                                >
                                                    {pago.conciliado ? "Conciliado" : "Diferencia"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
