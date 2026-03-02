"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CloudOff, CloudUpload, DollarSign, RefreshCw } from "lucide-react";
import {
    enqueueCobranzaAction,
    listCobranzaActions,
    removeCobranzaAction,
} from "./offlineQueue";

interface AgendaItem {
    id: string;
    cliente: string;
    dni: string;
    cobradorUsername: string;
    zona: string;
    fechaVencimiento: string;
    montoPendiente: number;
    cuotasRestantes: number;
    estado: "pendiente" | "pagado" | "vencido";
}

interface SessionInfo {
    role: string;
    username?: string;
    nombre?: string;
}

const formatARS = (value: number): string => {
    return Math.round(value || 0).toLocaleString("es-AR");
};

const formatDateLabel = (date: string): string => {
    try {
        const d = new Date(`${date}T00:00:00`);
        return d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" });
    } catch {
        return date;
    }
};

const todayIso = (): string => {
    return new Date().toISOString().slice(0, 10);
};

export default function CobranzasPage() {
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [agenda, setAgenda] = useState<AgendaItem[]>([]);
    const [windowDates, setWindowDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [queueCount, setQueueCount] = useState(0);
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [imputingId, setImputingId] = useState<string | null>(null);
    const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
    const [rendicionMonto, setRendicionMonto] = useState("");
    const [syncing, setSyncing] = useState(false);

    const refreshQueueCount = async () => {
        try {
            const queued = await listCobranzaActions();
            setQueueCount(queued.length);
        } catch {
            setQueueCount(0);
        }
    };

    const fetchAgenda = async (baseDate?: string) => {
        setLoading(true);
        setError("");
        try {
            const [meRes, agendaRes] = await Promise.all([
                fetch("/api/auth/me", { cache: "no-store" }),
                fetch(`/api/cobranzas/agenda${baseDate ? `?date=${encodeURIComponent(baseDate)}` : ""}`, {
                    cache: "no-store",
                }),
            ]);

            const meJson = await meRes.json();
            const agendaJson = await agendaRes.json();
            if (!meRes.ok || !meJson.success) {
                setError(meJson.error || "No se pudo obtener la sesion.");
                return;
            }
            setSession(meJson.data);

            if (!agendaRes.ok || !agendaJson.success) {
                setError(agendaJson.error || "No se pudo obtener agenda.");
                return;
            }

            const dates = Array.isArray(agendaJson.windowDates) ? agendaJson.windowDates : [];
            setWindowDates(dates);
            setSelectedDate((prev) => prev || dates[0] || todayIso());

            const items = Array.isArray(agendaJson.data) ? agendaJson.data : [];
            setAgenda(items);

            const drafts: Record<string, string> = {};
            items.forEach((item: AgendaItem) => {
                drafts[item.id] = String(Math.round(item.montoPendiente || 0));
            });
            setAmountDrafts(drafts);
        } catch {
            setError("Error de red al cargar cobranzas.");
        } finally {
            setLoading(false);
        }
    };

    const syncOfflineQueue = async () => {
        setSyncing(true);
        try {
            const queued = await listCobranzaActions();
            for (const action of queued) {
                const res = await fetch("/api/cobranzas/imputar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(action.payload),
                });
                const json = await res.json();
                if (res.ok && json.success) {
                    await removeCobranzaAction(action.id);
                }
            }
            await refreshQueueCount();
            await fetchAgenda(selectedDate || undefined);
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
        void fetchAgenda();
        void refreshQueueCount();

        const onOnline = () => {
            setIsOnline(true);
            void syncOfflineQueue();
        };
        const onOffline = () => setIsOnline(false);

        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    const agendaFiltrada = useMemo(() => {
        if (!selectedDate) return agenda;
        return agenda.filter((item) => item.fechaVencimiento === selectedDate);
    }, [agenda, selectedDate]);

    const totalDia = useMemo(() => {
        return agendaFiltrada.reduce((acc, item) => acc + Number(item.montoPendiente || 0), 0);
    }, [agendaFiltrada]);

    const handleImputar = async (item: AgendaItem) => {
        const monto = Number(amountDrafts[item.id] ?? item.montoPendiente);
        if (!Number.isFinite(monto) || monto <= 0) {
            window.alert("Monto invalido.");
            return;
        }

        const payload = {
            agendaId: item.id,
            monto,
            fechaImputacion: todayIso(),
            fechaDeudaObjetivo: selectedDate || item.fechaVencimiento,
            medioPago: "efectivo",
            observaciones: "",
        };

        if (!isOnline) {
            await enqueueCobranzaAction({
                id: `${item.id}-${Date.now()}`,
                payload,
                createdAt: new Date().toISOString(),
            });
            await refreshQueueCount();
            window.alert("Sin conexion. El pago quedo en cola offline para sincronizar.");
            return;
        }

        setImputingId(item.id);
        try {
            const res = await fetch("/api/cobranzas/imputar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                window.alert(json.error || "No se pudo imputar el pago.");
                return;
            }
            await fetchAgenda(selectedDate || undefined);
        } finally {
            setImputingId(null);
        }
    };

    const handleRendicion = async () => {
        const monto = Number(rendicionMonto);
        if (!Number.isFinite(monto) || monto <= 0) {
            window.alert("Monto de rendicion invalido.");
            return;
        }
        try {
            const res = await fetch("/api/cobranzas/rendicion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fecha: todayIso(),
                    montoTotal: monto,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                window.alert(json.error || "No se pudo registrar la rendicion.");
                return;
            }
            setRendicionMonto("");
            window.alert("Rendicion registrada.");
        } catch {
            window.alert("Error de red al registrar rendicion.");
        }
    };

    return (
        <main className="min-h-screen bg-[#0a1220] text-slate-200 px-3 sm:px-6 py-6">
            <div className="max-w-6xl mx-auto space-y-5">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-white">Cobranzas</h1>
                        <p className="text-sm text-slate-400">
                            Vista diaria y futura (lunes a jueves) por zona y cobrador.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchAgenda(selectedDate || undefined)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualizar
                        </button>
                        <a
                            href="/cotizador"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                        >
                            Volver
                        </a>
                    </div>
                </header>

                <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Usuario</p>
                        <p className="text-base font-black text-white">
                            {session?.nombre || session?.username || "-"}
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Conexion</p>
                        <p className={`text-base font-black ${isOnline ? "text-emerald-300" : "text-amber-300"}`}>
                            {isOnline ? "Online" : "Offline"}
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Cola offline</p>
                        <p className="text-base font-black text-white">{queueCount} pagos pendientes</p>
                    </div>
                </section>

                {queueCount > 0 && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-amber-100 inline-flex items-center gap-2">
                            <CloudOff className="w-4 h-4" />
                            Hay pagos guardados offline. Se sincronizan al volver internet.
                        </p>
                        <button
                            onClick={syncOfflineQueue}
                            disabled={!isOnline || syncing}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 text-black text-sm font-bold disabled:opacity-50"
                        >
                            <CloudUpload className="w-4 h-4" />
                            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
                        </button>
                    </div>
                )}

                <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="flex flex-wrap gap-2">
                        {windowDates.map((date) => (
                            <button
                                key={date}
                                onClick={() => setSelectedDate(date)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                                    selectedDate === date
                                        ? "bg-sky-500/20 text-sky-200 border-sky-500/30"
                                        : "bg-slate-950 text-slate-300 border-slate-700"
                                }`}
                            >
                                <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
                                {formatDateLabel(date)}
                            </button>
                        ))}
                    </div>
                </section>

                {loading && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
                        Cargando agenda de cobranzas...
                    </div>
                )}

                {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <section className="space-y-3">
                        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
                            <p className="text-sm text-slate-300">
                                {agendaFiltrada.length} clientes en agenda para {formatDateLabel(selectedDate)}
                            </p>
                            <p className="text-sm font-black text-emerald-300">
                                Total: $ {formatARS(totalDia)}
                            </p>
                        </div>

                        {agendaFiltrada.length === 0 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-8 text-sm text-slate-400 text-center">
                                No hay clientes a cobrar para este dia.
                            </div>
                        )}

                        {agendaFiltrada.map((item) => (
                            <article
                                key={item.id}
                                className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-center"
                            >
                                <div className="md:col-span-2">
                                    <p className="text-white font-black">{item.cliente}</p>
                                    <p className="text-xs text-slate-400">
                                        DNI {item.dni || "-"} - Zona {item.zona || "-"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Cobrador: {item.cobradorUsername || "-"}
                                    </p>
                                </div>
                                <div className="text-sm">
                                    <p className="text-slate-500 text-[11px] uppercase">Cuotas restantes</p>
                                    <p className="font-bold text-slate-100">{item.cuotasRestantes}</p>
                                </div>
                                <div className="text-sm">
                                    <p className="text-slate-500 text-[11px] uppercase">Pendiente</p>
                                    <p className="font-bold text-emerald-300">$ {formatARS(item.montoPendiente)}</p>
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        value={amountDrafts[item.id] ?? ""}
                                        onChange={(e) =>
                                            setAmountDrafts((prev) => ({
                                                ...prev,
                                                [item.id]: e.target.value,
                                            }))
                                        }
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                                    />
                                </div>
                                <button
                                    onClick={() => handleImputar(item)}
                                    disabled={imputingId === item.id}
                                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50"
                                >
                                    <DollarSign className="w-4 h-4" />
                                    {imputingId === item.id ? "Guardando..." : "Imputar"}
                                </button>
                            </article>
                        ))}
                    </section>
                )}

                <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <h2 className="text-base font-black text-white mb-2">Rendicion diaria</h2>
                    <p className="text-xs text-slate-400 mb-3">
                        Concepcion rinde a cajero. Catamarca rinde al encargado y se entrega el viernes en casa central.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="number"
                            placeholder="Monto total rendido"
                            value={rendicionMonto}
                            onChange={(e) => setRendicionMonto(e.target.value)}
                            className="w-56 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        />
                        <button
                            onClick={handleRendicion}
                            className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
                        >
                            Registrar rendicion
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}

