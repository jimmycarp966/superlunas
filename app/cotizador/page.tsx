/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from "react";
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
        <div className={`rounded-lg border overflow-visible relative ${cardClass}`}>
            {!isContado && p.badge && (
                <span className="absolute top-0 right-2 -translate-y-1/2 z-20 bg-gradient-to-b from-[#ff6a56] to-[#cf2f22] border border-[#ffb29d]/80 text-white text-[11px] sm:text-[12px] px-4 py-1.5 rounded-full uppercase font-black tracking-[0.09em] whitespace-nowrap leading-none shadow-[0_2px_0_#8b1b12,0_7px_14px_rgba(0,0,0,0.4)]">
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
    onFicha: (calc: any & { selectedPlanId?: string }) => void;
    mode?: "single" | "cart" | "manual";
}

interface CartItem {
    codigo: string;
    nombre: string;
    precio: number;
    stock: number;
    qty: number;
}

function CotizadorCol({ products, plans, settings, onFicha, mode = "single" }: ColProps) {
    const [search, setSearch] = useState("");
    const [product, setProduct] = useState<any | null>(null);
    const [manualDescription, setManualDescription] = useState("");
    const [manualPrice, setManualPrice] = useState(0);
    const [qty, setQty] = useState(1);
    const [anticipo, setAnticipo] = useState(0);
    const [copied, setCopied] = useState(false);
    const [copiedPhoto, setCopiedPhoto] = useState(false);
    const [primeraCuotaMap, setPrimeraCuotaMap] = useState<Record<string, boolean>>({});
    const [selectedPlanId, setSelectedPlanId] = useState("");
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const deferredSearch = useDeferredValue(search);
    const productsByCode = useMemo(() => {
        const map = new Map<string, any>();
        for (const item of products) {
            const code = String(item?.codigo ?? "");
            if (!code) continue;
            map.set(code, item);
        }
        return map;
    }, [products]);

    useEffect(() => {
        if (!product) return;
        const updated = productsByCode.get(String(product.codigo));
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
    }, [productsByCode, product]);

    useEffect(() => {
        if (mode !== "cart") return;
        setCartItems((prev) =>
            prev.map((item) => {
                const updated = productsByCode.get(item.codigo);
                if (!updated) return item;
                const updatedPrecio = Number(updated.precio);
                const updatedStock = Number(updated.stock);
                return {
                    ...item,
                    nombre: String(updated.nombre ?? item.nombre),
                    precio: Number.isFinite(updatedPrecio) ? updatedPrecio : item.precio,
                    stock: Number.isFinite(updatedStock) ? updatedStock : item.stock,
                };
            })
        );
    }, [productsByCode, mode]);

    useEffect(() => {
        const validIds = new Set(plans.map((p: any) => String(p.id)));
        setPrimeraCuotaMap((prev) => {
            const next: Record<string, boolean> = {};
            for (const [id, checked] of Object.entries(prev)) {
                if (checked && validIds.has(id)) next[id] = true;
            }
            return next;
        });

        setSelectedPlanId((prev) => {
            if (prev && validIds.has(String(prev))) return String(prev);
            return plans[0] ? String(plans[0].id) : "";
        });
    }, [plans]);

    const filtered = useMemo(() => {
        const q = deferredSearch.toLowerCase().trim();
        if (!q) return products.slice(0, 100);
        return products
            .filter(
                (p) =>
                    p.nombre.toLowerCase().includes(q) ||
                    p.codigo.toLowerCase().includes(q)
            )
            .slice(0, 100);
    }, [deferredSearch, products]);

    const calc = useMemo(() => {
        const manualDesc = manualDescription.trim();
        const manualUnitPrice = Number(manualPrice) || 0;
        const subtotal = mode === "cart"
            ? cartItems.reduce((acc, item) => acc + item.precio * item.qty, 0)
            : mode === "manual"
                ? (manualDesc && manualUnitPrice > 0 ? manualUnitPrice * qty : 0)
                : (Number(product?.precio) || 0) * qty;
        const itemsText = mode === "cart"
            ? cartItems.map((item) => `${item.qty}x [${item.codigo}] ${item.nombre}`).join("\n")
            : mode === "manual"
                ? (manualDesc && manualUnitPrice > 0 ? `${qty}x ${manualDesc}` : "")
                : product
                    ? (qty > 1 ? `${qty}x ` : "") + `[${product.codigo}] ${product.nombre}`
                    : "";
        return {
            subtotal,
            anticipo,
            planStats: calcPlanStats(subtotal, anticipo, plans, settings, primeraCuotaMap),
            itemsText,
        };
    }, [mode, cartItems, manualDescription, manualPrice, product, qty, anticipo, plans, settings, primeraCuotaMap]);

    const handleLimpiar = () => {
        setProduct(null);
        setManualDescription("");
        setManualPrice(0);
        setQty(1);
        setAnticipo(0);
        setSearch("");
        if (mode === "cart") setCartItems([]);
        setPrimeraCuotaMap({});
        setSelectedPlanId(plans[0] ? String(plans[0].id) : "");
    };

    const handleStock = () => {
        if (product) alert(`Stock de "${product.nombre}": ${product.stock} unidades`);
    };

    const handleAgregar = () => {
        if (!product) return;
        const codigo = String(product.codigo ?? "").trim();
        if (!codigo) return;

        const nombre = String(product.nombre ?? "");
        const precio = Number(product.precio) || 0;
        const stock = Number(product.stock) || 0;

        setCartItems((prev) => {
            const existingIndex = prev.findIndex((item) => item.codigo === codigo);
            if (existingIndex === -1) {
                if (stock > 0 && qty > stock) {
                    alert(`Stock insuficiente. Disponible: ${stock}`);
                    return prev;
                }
                return [...prev, { codigo, nombre, precio, stock, qty }];
            }

            const currentQty = prev[existingIndex].qty;
            if (stock > 0 && currentQty + qty > stock) {
                alert(`Stock insuficiente. Disponible: ${stock}. En carrito: ${currentQty}`);
                return prev;
            }

            return prev.map((item, index) =>
                index === existingIndex
                    ? {
                        ...item,
                        qty: item.qty + qty,
                        precio,
                        stock,
                        nombre,
                    }
                    : item
            );
        });

        setProduct(null);
        setQty(1);
        setSearch("");
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

    const handleCopyPhoto = async () => {
        if (!product?.imagenUrl) return;
        try {
            await navigator.clipboard.writeText(String(product.imagenUrl));
            setCopiedPhoto(true);
            setTimeout(() => setCopiedPhoto(false), 1800);
        } catch {
            setCopiedPhoto(false);
        }
    };

    const handleSendWhatsapp = () => {
        if (disableActions) return;
        const text = generatePresupuestoText(calc);
        const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, "_blank");
    };

    const selectedProductSubtotal = (Number(product?.precio) || 0) * qty;
    const isCartMode = mode === "cart";
    const isManualMode = mode === "manual";
    const disableActions = (isCartMode || isManualMode) && calc.subtotal <= 0;
    const totalUnidadesCarrito = cartItems.reduce((acc, item) => acc + item.qty, 0);

    return (
        <div className="bg-[#1a2638] border border-[#2d3b4f] rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
            {isManualMode ? (
                <>
                    <input
                        type="text"
                        placeholder="Descripcion"
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                        className="w-full bg-[#0d1522] border border-[#f0a12e] rounded-lg px-3 py-2 text-white text-sm sm:text-base font-bold placeholder-gray-500 focus:outline-none"
                    />
                    <input
                        type="number"
                        placeholder="Precio"
                        value={manualPrice || ""}
                        onChange={(e) => setManualPrice(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-[#0f1a2a] border border-[#2d3b4f] text-white font-bold rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                    />
                    <button
                        onClick={handleLimpiar}
                        className="w-full bg-[#ef3d2f] hover:bg-[#dc3528] text-white font-black py-2 rounded-md text-[12px] tracking-wide uppercase"
                    >
                        Limpiar
                    </button>
                </>
            ) : (
                <>
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
                            const p = productsByCode.get(e.target.value);
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
                            onClick={isCartMode ? handleAgregar : handleStock}
                            disabled={isCartMode && !product}
                            className="bg-[#58d64a] hover:bg-[#4ec342] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-2 rounded-md text-[12px] tracking-wide uppercase"
                        >
                            {isCartMode ? "Agregar" : "Stock"}
                        </button>
                    </div>
                </>
            )}

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

            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={() => {
                        if (disableActions) return;
                        const selectedFromCuota = calc.planStats.find((p: any) => Boolean(p.primeraCuotaPaga));
                        const selectedFromState = calc.planStats.find((p: any) => String(p.id) === String(selectedPlanId));
                        const fallback = calc.planStats[0];
                        const resolvedPlanId =
                            String(selectedFromCuota?.id ?? selectedFromState?.id ?? fallback?.id ?? "");

                        onFicha({
                            ...calc,
                            selectedPlanId: resolvedPlanId,
                        });
                    }}
                    disabled={disableActions}
                    className="bg-[#47d98a] hover:bg-[#3fc57c] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-2 rounded-md text-[12px] uppercase tracking-wide flex items-center justify-center gap-1.5"
                >
                    <ClipboardList className="w-4 h-4" /> Ficha
                </button>
                <button
                    onClick={handleCopyPresupuesto}
                    disabled={disableActions}
                    className="bg-[#29b4f0] hover:bg-[#239dd1] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-2 rounded-md text-[12px] uppercase tracking-wide flex items-center justify-center gap-1.5"
                >
                    <ClipboardList className="w-4 h-4" /> Copiar
                </button>
                <button
                    onClick={handleSendWhatsapp}
                    disabled={disableActions}
                    className="bg-[#25D366] hover:bg-[#1fb95a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-2 rounded-md text-[12px] uppercase tracking-wide flex items-center justify-center gap-1.5"
                >
                    WhatsApp
                </button>
            </div>

            {copied && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-md px-2.5 py-1.5 text-center">
                    Mensaje copiado
                </div>
            )}
            {copiedPhoto && (
                <div className="bg-sky-500/20 border border-sky-500/40 text-sky-200 text-xs font-bold rounded-md px-2.5 py-1.5 text-center">
                    URL de foto copiada
                </div>
            )}

            {isCartMode && (
                <div className="bg-[#101827] border border-[#2d3b4f] rounded-lg px-3 py-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <p className="text-white/90 text-xs font-black uppercase tracking-wide">Carrito</p>
                        <span className="text-[#6de67f] text-[11px] font-black">
                            {cartItems.length} prod. / {totalUnidadesCarrito} unid.
                        </span>
                    </div>
                    {cartItems.length === 0 ? (
                        <p className="text-white/50 text-xs">Todavia no agregaste productos.</p>
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {cartItems.map((item) => (
                                <div
                                    key={item.codigo}
                                    className="bg-[#0f1724] border border-[#2d3b4f] rounded-md px-2.5 py-2 flex items-start justify-between gap-2"
                                >
                                    <div className="min-w-0">
                                        <p className="text-white text-xs font-bold truncate">
                                            {item.qty}x [{item.codigo}] {item.nombre}
                                        </p>
                                        <p className="text-[#ffc64f] text-[11px] font-black">
                                            $ {formatARS(item.precio * item.qty)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setCartItems((prev) => prev.filter((p) => p.codigo !== item.codigo))}
                                        className="text-[10px] uppercase font-black px-2 py-1 rounded bg-[#ef3d2f] hover:bg-[#dc3528] text-white shrink-0"
                                    >
                                        Quitar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isManualMode ? (
                manualDescription.trim() || manualPrice > 0 ? (
                    <div className="bg-[#0f1724] border border-[#f0a12e] rounded-lg px-3 py-2.5">
                        <div className="text-white font-black text-[15px] sm:text-[19px] leading-tight uppercase">
                            {manualDescription.trim() || "Sin descripcion"}
                        </div>
                        <div className="text-[#ffc64f] font-extrabold text-[30px] sm:text-[40px] leading-none mt-1">
                            ${formatARS(calc.subtotal)}
                        </div>
                        <span className="inline-block mt-1 text-[11px] px-2 py-[2px] rounded font-black bg-[#2b8f40] text-white">
                            Precio unitario: ${formatARS(manualPrice)}
                        </span>
                    </div>
                ) : (
                    <div className="bg-[#101827] border border-[#2d3b4f] rounded-lg px-3 py-4 text-center text-white/45 font-semibold text-sm">
                        Carga descripcion y precio
                    </div>
                )
            ) : product ? (
                <div className="bg-[#0f1724] border border-[#f0a12e] rounded-lg px-3 py-2.5">
                    <div className="text-white font-black text-[15px] sm:text-[19px] leading-tight uppercase">
                        [{product.codigo}] {product.nombre}
                    </div>
                    {product.imagenUrl && (
                        <div className="mt-2">
                            <img
                                src={String(product.imagenUrl)}
                                alt={product.nombre}
                                className="w-full h-28 object-cover rounded border border-[#2d3b4f]"
                            />
                            <button
                                onClick={handleCopyPhoto}
                                className="mt-2 w-full bg-[#2c8ffd] hover:bg-[#277fdd] text-white text-[11px] font-black py-1.5 rounded uppercase tracking-wide"
                            >
                                Copiar Foto al Cotizador
                            </button>
                        </div>
                    )}
                    <div className="text-[#ffc64f] font-extrabold text-[30px] sm:text-[40px] leading-none mt-1">
                        ${formatARS(selectedProductSubtotal)}
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
                            onTogglePrimeraCuota={(planId, checked) => {
                                setPrimeraCuotaMap((prev) => ({ ...prev, [planId]: checked }));
                                if (checked) setSelectedPlanId(String(planId));
                            }}
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
    const plansSyncLastRunRef = useRef(0);

    const listOptions = useMemo(() => {
        const fromSettings = Array.isArray(settings?.listas) ? settings.listas : [];
        const fallback = selectedList ? [selectedList] : ["local"];
        const merged = fromSettings.length > 0 ? fromSettings : fallback;
        return Array.from(
            new Set(
                merged
                    .map((value) => String(value ?? "").trim().toLowerCase())
                    .filter(Boolean)
            )
        );
    }, [settings, selectedList]);

    const fetchPlans = useCallback(async () => {
        try {
            const res = await fetch("/api/plans", { cache: "no-store" });
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
            const res = await fetch("/api/settings", { cache: "no-store" });
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

    const fetchProducts = useCallback(async (listName: string) => {
        const listKey = (listName || "").trim().toLowerCase() || "local";
        try {
            const res = await fetch(
                `/api/products?list=${encodeURIComponent(listKey)}`,
                { cache: "no-store" }
            );
            const json = await res.json();
            if (json.success) {
                setProducts(json.data);
                return true;
            }
        } catch {
            // Ignorado: se mantiene el ultimo estado util.
        }
        return false;
    }, []);

    const handleListChange = useCallback((nextListRaw: string) => {
        const nextList = String(nextListRaw ?? "").trim().toLowerCase() || "local";
        setSelectedList(nextList);
        void fetchProducts(nextList);
    }, [fetchProducts]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            const [, settingsData] = await Promise.all([fetchPlans(), fetchSettings()]);
            if (!active) return;
            let initialList = "local";
            if (settingsData?.listas?.length > 0) {
                initialList = String(settingsData.listas[0]).trim().toLowerCase() || "local";
            }
            setSelectedList(initialList);
            await fetchProducts(initialList);
            if (!active) return;
            setLoading(false);
        };
        void load();
        return () => {
            active = false;
        };
    }, [fetchPlans, fetchSettings, fetchProducts]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        let channel: BroadcastChannel | null = null;
        const syncPlans = () => {
            const now = Date.now();
            if (now - plansSyncLastRunRef.current < 4000) return;
            plansSyncLastRunRef.current = now;
            void fetchPlans();
        };

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

    if (loading) {
        return <div className="p-8 text-neutral-500 text-sm">Cargando cotizador...</div>;
    }

    return (
        <div className="w-full max-w-[1500px] px-2 sm:px-3 md:px-6 py-3 flex flex-col items-center gap-4">
            <div className="w-full max-w-[520px] bg-[#1a2638] border border-[#2d3b4f] rounded-xl p-2.5 shadow-[0_5px_16px_rgba(0,0,0,0.35)]">
                <div className="flex items-center gap-2">
                    <select
                        value={selectedList}
                        onChange={(e) => handleListChange(e.target.value)}
                        className="flex-1 bg-[#f5f7fb] text-[#223049] font-black px-4 py-2 rounded-lg focus:outline-none text-sm"
                    >
                        {listOptions.map((lst: string) => (
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
                    mode="cart"
                    onFicha={(calc) => {
                        setActiveCalc(calc);
                        setShowRegistration(true);
                    }}
                />
                <CotizadorCol
                    products={products}
                    plans={plans}
                    settings={settings}
                    mode="manual"
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
