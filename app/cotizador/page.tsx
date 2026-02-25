/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ClipboardList, RotateCcw, Check } from "lucide-react";
import { calcPlanStats, generatePresupuestoText, formatARS } from "./utils";
import RegistrationModal from "./RegistrationModal";

const PLANS_SYNC_CHANNEL = "plans-updates";
const PLANS_SYNC_STORAGE_KEY = "lunas_plans_updated_at";

function PlanCard({
    p,
    onTogglePrimeraCuota,
}: {
    p: any;
    onTogglePrimeraCuota: (planId: string, checked: boolean) => void;
}) {
    const isContado = p.semanas === 0;
    const cardClass = isContado
        ? "border-[#596474] bg-[#3f4855]"
        : "border-[#f0a12e] bg-[#2f3cad]";
    const titleClass = isContado ? "text-[#d8deea]" : "text-[#ffc64f]";
    const amountClass = isContado ? "text-white" : "text-[#ffd661]";
    const subtitleClass = isContado ? "text-[#d8deea]" : "text-[#dbe0ff]";
    const totalMostrado = p.primeraCuotaPaga ? p.saldo : p.calcTotal;

    return (
        <div className={`rounded-lg border overflow-hidden relative ${cardClass}`}>
            {!isContado && p.badge && (
                <span className="absolute top-1.5 right-1.5 bg-[#f04a40] text-white text-[9px] px-2 py-[1px] rounded-full uppercase font-black tracking-wide">
                    {p.badge}
                </span>
            )}
            <div className={`px-3 pt-2 pb-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wide ${titleClass}`}>
                {isContado ? "Contado" : `${p.semanas} semanas`}
            </div>
            <div className="px-3 pb-2">
                <div className={`text-[27px] sm:text-[34px] leading-none font-extrabold ${amountClass}`}>
                    ${formatARS(totalMostrado)}
                </div>
                <div className={`text-[12px] sm:text-[13px] font-semibold mt-1 ${subtitleClass}`}>
                    {isContado
                        ? `1 cuota de $ ${formatARS(p.calcTotal)}`
                        : p.primeraCuotaPaga
                            ? `1ra paga · quedan ${p.cuotasPendientes} de $ ${formatARS(p.cuota)}`
                            : `${p.semanas} cuotas de $ ${formatARS(p.cuota)}`}
                </div>
                {!isContado && (
                    <label className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] text-white/90 font-bold uppercase tracking-wide cursor-pointer">
                        <input
                            type="checkbox"
                            checked={Boolean(p.primeraCuotaPaga)}
                            onChange={(e) => onTogglePrimeraCuota(String(p.id), e.target.checked)}
                            className="accent-emerald-500 w-3.5 h-3.5"
                        />
                        Paga 1ra cuota
                    </label>
                )}
            </div>
        </div>
    );
}

interface ColProps {
    products: any[];
    plans: any[];
    settings: any;
    onFicha: (calc: any) => void;
}

function CotizadorCol({ products, plans, settings, onFicha }: ColProps) {
    const [search, setSearch] = useState("");
    const [product, setProduct] = useState<any | null>(null);
    const [qty, setQty] = useState(1);
    const [anticipo, setAnticipo] = useState(0);
    const [copied, setCopied] = useState(false);
    const [primeraCuotaMap, setPrimeraCuotaMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!product) return;
        const updated = products.find((p) => p.codigo === product.codigo);
        if (!updated) {
            setProduct(null);
            return;
        }
        if (
            updated.precio !== product.precio ||
            updated.stock !== product.stock ||
            updated.nombre !== product.nombre
        ) {
            setProduct(updated);
        }
    }, [products, product]);

    useEffect(() => {
        const validIds = new Set(plans.map((p: any) => String(p.id)));
        setPrimeraCuotaMap((prev) => {
            const next: Record<string, boolean> = {};
            for (const [id, checked] of Object.entries(prev)) {
                if (checked && validIds.has(id)) next[id] = true;
            }
            return next;
        });
    }, [plans]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return products.slice(0, 100);
        return products
            .filter(
                (p) =>
                    p.nombre.toLowerCase().includes(q) ||
                    p.codigo.toLowerCase().includes(q)
            )
            .slice(0, 100);
    }, [search, products]);

    const calc = useMemo(() => {
        const subtotal = (product?.precio || 0) * qty;
        const itemsText = product
            ? (qty > 1 ? `${qty}x ` : "") + `[${product.codigo}] ${product.nombre}`
            : "";
        return {
            subtotal,
            anticipo,
            planStats: calcPlanStats(subtotal, anticipo, plans, settings, primeraCuotaMap),
            itemsText,
        };
    }, [product, qty, anticipo, plans, settings, primeraCuotaMap]);

    const handleLimpiar = () => {
        setProduct(null);
        setQty(1);
        setAnticipo(0);
        setSearch("");
        setPrimeraCuotaMap({});
    };

    const handleStock = () => {
        if (product) alert(`Stock de "${product.nombre}": ${product.stock} unidades`);
    };

    const handleCopyPresupuesto = async () => {
        try {
            await navigator.clipboard.writeText(generatePresupuestoText(calc));
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="bg-[#1a2638] border border-[#2d3b4f] rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
            <input
                type="text"
                placeholder="Codigo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0d1522] border border-[#f0a12e] rounded-lg px-3 py-2 text-white text-sm sm:text-base font-bold placeholder-gray-500 focus:outline-none"
            />

            <select
                className="w-full bg-[#0f1a2a] border border-[#2d3b4f] text-white font-bold rounded-lg px-3 py-2.5 text-sm focus:outline-none cursor-pointer"
                value={product?.codigo || ""}
                onChange={(e) => {
                    const p = products.find((prod) => prod.codigo === e.target.value);
                    setProduct(p || null);
                }}
            >
                <option value="">Resultados...</option>
                {filtered.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                        [{p.codigo}] {p.nombre}
                    </option>
                ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={handleLimpiar}
                    className="bg-[#ef3d2f] hover:bg-[#dc3528] text-white font-black py-2 rounded-md text-[12px] tracking-wide uppercase"
                >
                    Limpiar
                </button>
                <button
                    onClick={handleStock}
                    className="bg-[#58d64a] hover:bg-[#4ec342] text-white font-black py-2 rounded-md text-[12px] tracking-wide uppercase"
                >
                    Stock
                </button>
            </div>

            <div className="flex items-center gap-2 bg-[#0f1a2a] border border-[#2d3b4f] rounded-md px-2.5 py-1.5">
                <span className="text-white/85 font-bold text-sm">Cantidad:</span>
                <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="bg-[#ef3d2f] hover:bg-[#dc3528] w-7 h-7 rounded text-white font-black text-lg leading-none"
                >
                    -
                </button>
                <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-transparent text-center text-white text-lg font-extrabold focus:outline-none"
                />
                <button
                    onClick={() => setQty(qty + 1)}
                    className="bg-[#58d64a] hover:bg-[#4ec342] w-7 h-7 rounded text-white font-black text-lg leading-none"
                >
                    +
                </button>
            </div>

            <input
                type="number"
                placeholder="Anticipo (Opcional)"
                value={anticipo || ""}
                onChange={(e) => setAnticipo(parseInt(e.target.value) || 0)}
                className="w-full bg-[#f3e8c8] text-[#2b2b2b] font-bold px-3 py-2 rounded-md border border-[#e7d7ae] focus:outline-none text-sm"
            />

            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => onFicha(calc)}
                    className="bg-[#47d98a] hover:bg-[#3fc57c] text-white font-black py-2 rounded-md text-[12px] uppercase tracking-wide flex items-center justify-center gap-1.5"
                >
                    <ClipboardList className="w-4 h-4" /> Ficha
                </button>
                <button
                    onClick={handleCopyPresupuesto}
                    className="bg-[#29b4f0] hover:bg-[#239dd1] text-white font-black py-2 rounded-md text-[12px] uppercase tracking-wide flex items-center justify-center gap-1.5"
                >
                    <ClipboardList className="w-4 h-4" /> Copiar
                </button>
            </div>

            {copied && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-md px-2.5 py-1.5 text-center">
                    Mensaje copiado
                </div>
            )}

            {product ? (
                <div className="bg-[#0f1724] border border-[#f0a12e] rounded-lg px-3 py-2.5">
                    <div className="text-white font-black text-[15px] sm:text-[19px] leading-tight uppercase">
                        [{product.codigo}] {product.nombre}
                    </div>
                    <div className="text-[#ffc64f] font-extrabold text-[30px] sm:text-[40px] leading-none mt-1">
                        ${formatARS(calc.subtotal)}
                    </div>
                    <span
                        className={`inline-block mt-1 text-[11px] px-2 py-[2px] rounded font-black ${
                            Number(product.stock) > 0
                                ? "bg-[#2b8f40] text-white"
                                : "bg-[#b6372f] text-white"
                        }`}
                    >
                        Stock: {product.stock}
                    </span>
                </div>
            ) : (
                <div className="bg-[#101827] border border-[#2d3b4f] rounded-lg px-3 py-4 text-center text-white/45 font-semibold text-sm">
                    Sin producto seleccionado
                </div>
            )}

            {calc.subtotal > 0 && (
                <div className="flex flex-col gap-2">
                    {calc.planStats.map((p: any) => (
                        <PlanCard
                            key={p.id}
                            p={p}
                            onTogglePrimeraCuota={(planId, checked) =>
                                setPrimeraCuotaMap((prev) => ({ ...prev, [planId]: checked }))
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function CotizadorPage() {
    const [settings, setSettings] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedList, setSelectedList] = useState<string>("local");
    const [loading, setLoading] = useState(true);

    const [showRegistration, setShowRegistration] = useState(false);
    const [activeCalc, setActiveCalc] = useState<any | null>(null);

    const fetchPlans = useCallback(async () => {
        try {
            const res = await fetch(`/api/plans?_t=${Date.now()}`, { cache: "no-store" });
            const json = await res.json();
            if (json.success) {
                setPlans(
                    json.data
                        .sort((a: any, b: any) => a.orden - b.orden)
                        .filter((p: any) => p.activo)
                );
                return true;
            }
        } catch {
            // Ignorado: se mantiene el ultimo estado util.
        }
        return false;
    }, []);

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch(`/api/settings?_t=${Date.now()}`, { cache: "no-store" });
            const json = await res.json();
            if (json.success) {
                setSettings(json.data);
                return json.data;
            }
        } catch {
            // Ignorado: se mantiene el ultimo estado util.
        }
        return null;
    }, []);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            const [_, settingsData] = await Promise.all([fetchPlans(), fetchSettings()]);
            if (!active) return;
            if (settingsData?.listas?.length > 0) {
                setSelectedList(String(settingsData.listas[0]));
            }
            setLoading(false);
        };
        void load();
        return () => {
            active = false;
        };
    }, [fetchPlans, fetchSettings]);

    useEffect(() => {
        if (settings) fetchProducts(selectedList);
    }, [selectedList, settings]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        let channel: BroadcastChannel | null = null;
        const syncPlans = () => { void fetchPlans(); };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === PLANS_SYNC_STORAGE_KEY) syncPlans();
        };
        const handleFocus = () => syncPlans();
        const handleVisibility = () => {
            if (document.visibilityState === "visible") syncPlans();
        };

        if ("BroadcastChannel" in window) {
            channel = new BroadcastChannel(PLANS_SYNC_CHANNEL);
            channel.onmessage = (event) => {
                if (event.data?.type === "plans-updated") syncPlans();
            };
        }

        window.addEventListener("storage", handleStorage);
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
            if (channel) channel.close();
        };
    }, [fetchPlans]);

    async function fetchProducts(listName: string) {
        const listKey = (listName || "").trim().toLowerCase();
        try {
            const res = await fetch(
                `/api/products?list=${encodeURIComponent(listKey)}&_t=${Date.now()}`,
                { cache: "no-store" }
            );
            const json = await res.json();
            if (json.success) setProducts(json.data);
        } catch {
            // Ignorado: se mantiene el ultimo estado util.
        }
    }

    if (loading) {
        return <div className="p-8 text-neutral-500 text-sm">Cargando cotizador...</div>;
    }

    return (
        <div className="w-full max-w-[1500px] px-2 sm:px-3 md:px-6 py-3 flex flex-col items-center gap-4">
            <div className="w-full max-w-[520px] bg-[#1a2638] border border-[#2d3b4f] rounded-xl p-2.5 shadow-[0_5px_16px_rgba(0,0,0,0.35)]">
                <div className="flex items-center gap-2">
                    <select
                        value={selectedList}
                        onChange={(e) => setSelectedList(e.target.value)}
                        className="flex-1 bg-[#f5f7fb] text-[#223049] font-black px-4 py-2 rounded-lg focus:outline-none text-sm"
                    >
                        {settings?.listas.map((lst: string) => (
                            <option key={lst} value={lst}>
                                LISTA {lst.toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => fetchProducts(selectedList)}
                        className="bg-[#2c8ffd] hover:bg-[#277fdd] text-white p-2 rounded-lg transition-colors"
                        title="Actualizar productos"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-[#6de67f] font-black text-xs flex items-center justify-center gap-1 mt-1.5">
                    <Check className="w-3.5 h-3.5" /> {products.length} productos
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 w-full">
                <CotizadorCol
                    products={products}
                    plans={plans}
                    settings={settings}
                    onFicha={(calc) => {
                        setActiveCalc(calc);
                        setShowRegistration(true);
                    }}
                />
                <CotizadorCol
                    products={products}
                    plans={plans}
                    settings={settings}
                    onFicha={(calc) => {
                        setActiveCalc(calc);
                        setShowRegistration(true);
                    }}
                />
                <CotizadorCol
                    products={products}
                    plans={plans}
                    settings={settings}
                    onFicha={(calc) => {
                        setActiveCalc(calc);
                        setShowRegistration(true);
                    }}
                />
            </div>

            {showRegistration && activeCalc && (
                <RegistrationModal
                    calc={activeCalc}
                    colLabel=""
                    onClose={() => setShowRegistration(false)}
                />
            )}
        </div>
    );
}
