"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Navigation, RefreshCw } from "lucide-react";

interface RutaItem {
    id: string;
    fecha_programada?: string;
    cliente?: string;
    direccion?: string;
    detalle?: string;
}

interface GpsPoint {
    lat: number;
    lng: number;
    accuracy?: number | null;
    at: string;
}

const GPS_QUEUE_KEY = "lunas_reparto_gps_queue";
const DELIVERY_QUEUE_KEY = "lunas_reparto_delivery_queue";

interface OfflineDeliveryItem {
    id: string;
    payload: {
        rutaId: string;
        cliente: string;
        direccion: string;
        firmaUrl?: string;
        fotoEntregaUrl?: string;
        checklistCamion: Record<string, boolean>;
        lat: number | null;
        lng: number | null;
    };
    createdAt: string;
}

const readGpsQueue = (): GpsPoint[] => {
    try {
        const raw = localStorage.getItem(GPS_QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeGpsQueue = (points: GpsPoint[]) => {
    localStorage.setItem(GPS_QUEUE_KEY, JSON.stringify(points));
};

const readDeliveryQueue = (): OfflineDeliveryItem[] => {
    try {
        const raw = localStorage.getItem(DELIVERY_QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeDeliveryQueue = (items: OfflineDeliveryItem[]) => {
    localStorage.setItem(DELIVERY_QUEUE_KEY, JSON.stringify(items));
};

export default function RepartoPage() {
    const [rutas, setRutas] = useState<RutaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [gpsQueueCount, setGpsQueueCount] = useState(0);
    const [deliveryQueueCount, setDeliveryQueueCount] = useState(0);
    const [currentGps, setCurrentGps] = useState<GpsPoint | null>(null);
    const [checklist, setChecklist] = useState({
        luces: false,
        frenos: false,
        combustible: false,
        papeles: false,
    });
    const watchIdRef = useRef<number | null>(null);
    const lastPingRef = useRef<number>(0);

    const checklistReady = useMemo(
        () => Object.values(checklist).every(Boolean),
        [checklist],
    );

    const fetchRutas = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/reparto/rutas", { cache: "no-store" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setError(json.error || "No se pudieron cargar rutas.");
                return;
            }
            setRutas(Array.isArray(json.data) ? json.data : []);
        } catch {
            setError("Error de red al cargar rutas.");
        } finally {
            setLoading(false);
        }
    };

    const syncGpsQueue = async () => {
        if (!navigator.onLine) return;
        const queued = readGpsQueue();
        if (queued.length === 0) {
            setGpsQueueCount(0);
            return;
        }

        const remaining: GpsPoint[] = [];
        for (const point of queued) {
            try {
                const res = await fetch("/api/reparto/gps", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lat: point.lat,
                        lng: point.lng,
                        accuracy: point.accuracy ?? null,
                    }),
                });
                if (!res.ok) remaining.push(point);
            } catch {
                remaining.push(point);
            }
        }

        writeGpsQueue(remaining);
        setGpsQueueCount(remaining.length);
    };

    const syncDeliveryQueue = async () => {
        if (!navigator.onLine) return;
        const queued = readDeliveryQueue();
        if (queued.length === 0) {
            setDeliveryQueueCount(0);
            return;
        }

        const remaining: OfflineDeliveryItem[] = [];
        for (const item of queued) {
            try {
                const res = await fetch("/api/reparto/entregas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(item.payload),
                });
                if (!res.ok) remaining.push(item);
            } catch {
                remaining.push(item);
            }
        }

        writeDeliveryQueue(remaining);
        setDeliveryQueueCount(remaining.length);
        if (remaining.length === 0) {
            await fetchRutas();
        }
    };

    const sendGpsPoint = async (point: GpsPoint) => {
        if (!navigator.onLine) {
            const queued = readGpsQueue();
            queued.push(point);
            writeGpsQueue(queued);
            setGpsQueueCount(queued.length);
            return;
        }

        try {
            const res = await fetch("/api/reparto/gps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lat: point.lat,
                    lng: point.lng,
                    accuracy: point.accuracy ?? null,
                }),
            });
            if (!res.ok) {
                const queued = readGpsQueue();
                queued.push(point);
                writeGpsQueue(queued);
                setGpsQueueCount(queued.length);
            }
        } catch {
            const queued = readGpsQueue();
            queued.push(point);
            writeGpsQueue(queued);
            setGpsQueueCount(queued.length);
        }
    };

    const registerEntrega = async (ruta: RutaItem) => {
        if (!checklistReady) {
            window.alert("Completa el checklist del camion antes de registrar una entrega.");
            return;
        }

        const firmaUrl = window.prompt("URL de firma digital (opcional):", "") || "";
        const fotoEntregaUrl = window.prompt("URL de foto de entrega (opcional):", "") || "";

        const payload = {
            rutaId: ruta.id,
            cliente: ruta.cliente ?? "Cliente sin nombre",
            direccion: ruta.direccion ?? "",
            firmaUrl: firmaUrl || undefined,
            fotoEntregaUrl: fotoEntregaUrl || undefined,
            checklistCamion: checklist,
            lat: currentGps?.lat ?? null,
            lng: currentGps?.lng ?? null,
        };

        if (!navigator.onLine) {
            const queued = readDeliveryQueue();
            queued.push({
                id: `${ruta.id}-${Date.now()}`,
                payload,
                createdAt: new Date().toISOString(),
            });
            writeDeliveryQueue(queued);
            setDeliveryQueueCount(queued.length);
            window.alert("Sin conexion. Entrega guardada offline para sincronizar.");
            return;
        }

        try {
            const res = await fetch("/api/reparto/entregas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                window.alert(json.error || "No se pudo registrar la entrega.");
                return;
            }
            window.alert("Entrega registrada.");
            await fetchRutas();
        } catch {
            const queued = readDeliveryQueue();
            queued.push({
                id: `${ruta.id}-${Date.now()}`,
                payload,
                createdAt: new Date().toISOString(),
            });
            writeDeliveryQueue(queued);
            setDeliveryQueueCount(queued.length);
            window.alert("Error de red. Entrega guardada offline para sincronizar.");
        }
    };

    useEffect(() => {
        setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
        setGpsQueueCount(readGpsQueue().length);
        setDeliveryQueueCount(readDeliveryQueue().length);
        void fetchRutas();
        void syncGpsQueue();
        void syncDeliveryQueue();

        const onlineHandler = () => {
            setIsOnline(true);
            void syncGpsQueue();
            void syncDeliveryQueue();
        };
        const offlineHandler = () => setIsOnline(false);
        window.addEventListener("online", onlineHandler);
        window.addEventListener("offline", offlineHandler);

        if ("geolocation" in navigator) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const now = Date.now();
                    const point: GpsPoint = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        at: new Date().toISOString(),
                    };
                    setCurrentGps(point);

                    // GPS en tiempo real cada 5s.
                    if (now - lastPingRef.current >= 5000) {
                        lastPingRef.current = now;
                        void sendGpsPoint(point);
                    }
                },
                () => {
                    // Permiso denegado o no disponible.
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 2000,
                    timeout: 8000,
                },
            );
        }

        return () => {
            window.removeEventListener("online", onlineHandler);
            window.removeEventListener("offline", offlineHandler);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    return (
        <main className="min-h-screen bg-[#0a1220] text-slate-200 px-3 sm:px-6 py-6">
            <div className="max-w-6xl mx-auto space-y-5">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-white">Reparto</h1>
                        <p className="text-sm text-slate-400">
                            PWA repartidor: GPS cada 5s, checklist y evidencia de entrega.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchRutas}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualizar
                        </button>
                        <a
                            href="/cotizador"
                            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                        >
                            Volver
                        </a>
                    </div>
                </header>

                <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                        <p className="text-xs uppercase text-slate-500 tracking-wide">Estado red</p>
                        <p className={`text-lg font-black ${isOnline ? "text-emerald-300" : "text-amber-300"}`}>
                            {isOnline ? "Online" : "Offline"}
                        </p>
                    </article>
                    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                        <p className="text-xs uppercase text-slate-500 tracking-wide">GPS actual</p>
                        <p className="text-sm text-slate-200">
                            {currentGps
                                ? `${currentGps.lat.toFixed(5)}, ${currentGps.lng.toFixed(5)}`
                                : "Sin coordenadas"}
                        </p>
                    </article>
                    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                        <p className="text-xs uppercase text-slate-500 tracking-wide">Cola offline</p>
                        <p className="text-lg font-black text-sky-300">
                            {gpsQueueCount} GPS / {deliveryQueueCount} entregas
                        </p>
                    </article>
                </section>

                <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <h2 className="text-base font-black text-white mb-3">Checklist camion</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.keys(checklist).map((key) => (
                            <label
                                key={key}
                                className="inline-flex items-center gap-2 text-sm text-slate-200 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2"
                            >
                                <input
                                    type="checkbox"
                                    checked={checklist[key as keyof typeof checklist]}
                                    onChange={(e) =>
                                        setChecklist((prev) => ({
                                            ...prev,
                                            [key]: e.target.checked,
                                        }))
                                    }
                                    className="accent-emerald-500"
                                />
                                {key}
                            </label>
                        ))}
                    </div>
                    {!checklistReady && (
                        <p className="text-xs text-amber-300 mt-2">
                            Completa el checklist para habilitar registro de entrega.
                        </p>
                    )}
                </section>

                {loading && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
                        Cargando rutas...
                    </div>
                )}
                {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <section className="space-y-2">
                        {rutas.length === 0 && (
                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400 text-center">
                                No hay rutas semanales cargadas.
                            </div>
                        )}
                        {rutas.map((ruta) => (
                            <article
                                key={ruta.id}
                                className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                            >
                                <div className="space-y-1">
                                    <p className="text-white font-black">{ruta.cliente || "Cliente sin nombre"}</p>
                                    <p className="text-xs text-slate-400">{ruta.direccion || "-"}</p>
                                    <p className="text-xs text-slate-500">{ruta.fecha_programada || "-"}</p>
                                    {ruta.detalle && <p className="text-xs text-slate-300">{ruta.detalle}</p>}
                                </div>
                                <button
                                    onClick={() => registerEntrega(ruta)}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Registrar entrega
                                </button>
                            </article>
                        ))}
                    </section>
                )}

                <footer className="text-xs text-slate-500 inline-flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5" />
                    El GPS sigue registrando en segundo plano; si se pierde internet se guarda y sincroniza despues.
                </footer>
            </div>
        </main>
    );
}
