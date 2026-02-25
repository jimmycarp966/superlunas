/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { ClipboardList, RotateCcw, Check } from "lucide-react";
import { calcPlanStats, generatePresupuestoText, formatARS } from "./utils";
import RegistrationModal from "./RegistrationModal";

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ p }: { p: any }) {
    const isContado = p.semanas === 0;
    const hasBadge = !!p.badge;
    const headerClass = isContado ? "bg-green-700" : hasBadge ? "bg-orange-600" : "bg-blue-700";
    return (
        <div className="rounded-xl overflow-hidden border border-[#2a2f3e]">
            <div className={`${headerClass} px-3 py-1.5 flex items-center justify-between`}>
                <span className="text-white font-extrabold text-xs uppercase tracking-wider">
                    {isContado ? "CONTADO" : `${p.semanas} SEMANAS`}
                </span>
                {hasBadge && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        {p.badge}
                    </span>
                )}
            </div>
            <div className="bg-[#131929] px-3 py-2">
                <div className="text-white font-extrabold text-xl leading-tight">
                    ${formatARS(p.calcTotal)}
                </div>
                <div className="text-gray-400 text-xs mt-0.5">
                    {isContado
                        ? `1 cuota de $${formatARS(p.calcTotal)}`
                        : `${p.semanas} cuotas de $${formatARS(p.cuota)}`}
                </div>
            </div>
        </div>
    );
}

// ─── Columna individual ───────────────────────────────────────────────────────
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

    useEffect(() => {
        if (!product) return;
        const updated = products.find(p => p.codigo === product.codigo);
        if (!updated) {
            setProduct(null);
            return;
        }
        const changed =
            updated.precio !== product.precio ||
            updated.stock !== product.stock ||
            updated.nombre !== product.nombre;
        if (changed) setProduct(updated);
    }, [products, product]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return products.slice(0, 100);
        return products
            .filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            .slice(0, 100);
    }, [search, products]);

    const calc = useMemo(() => {
        const subtotal = (product?.precio || 0) * qty;
        const itemsText = product
            ? (qty > 1 ? qty + "x " : "") + "[" + product.codigo + "] " + product.nombre
            : "";
        return {
            subtotal,
            anticipo,
            planStats: calcPlanStats(subtotal, anticipo, plans, settings),
            itemsText,
        };
    }, [product, qty, anticipo, plans, settings]);

    const handleLimpiar = () => {
        setProduct(null);
        setQty(1);
        setAnticipo(0);
        setSearch("");
    };

    const handleStock = () => {
        if (product) alert(`Stock de "${product.nombre}": ${product.stock} unidades`);
    };

    // ── styles ──
    const inputSearch = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500";
    const btnRed = "flex-1 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-extrabold py-2.5 rounded-lg text-sm tracking-wide transition-colors uppercase";
    const btnGreen = "flex-1 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-extrabold py-2.5 rounded-lg text-sm tracking-wide transition-colors uppercase";
    const btnBlue = "flex-1 bg-[#25A1ED] hover:bg-blue-400 active:bg-blue-600 text-white font-extrabold py-2.5 rounded-lg text-sm tracking-wide transition-colors uppercase";

    return (
        <div className="bg-[#1c2333] border border-[#2a2f3e] rounded-2xl p-4 flex flex-col gap-3">

            {/* Búsqueda */}
            <input
                type="text"
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={inputSearch}
            />

            {/* Dropdown con código siempre visible */}
            <select
                className="w-full bg-white text-gray-900 font-bold rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer"
                value={product?.codigo || ""}
                onChange={e => {
                    const p = products.find(prod => prod.codigo === e.target.value);
                    setProduct(p || null);
                }}
            >
                <option value="">Seleccione producto...</option>
                {filtered.map(p => (
                    <option key={p.codigo} value={p.codigo}>
                        [{p.codigo}] {p.nombre}
                    </option>
                ))}
            </select>

            {/* LIMPIAR / STOCK */}
            <div className="flex gap-2">
                <button onClick={handleLimpiar} className={btnRed}>LIMPIAR</button>
                <button onClick={handleStock} className={btnGreen}>STOCK</button>
            </div>

            {/* Cantidad */}
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2">
                <span className="text-gray-400 font-bold text-xs uppercase tracking-wide w-20">Cantidad:</span>
                <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="bg-orange-600 hover:bg-orange-500 w-8 h-8 rounded font-extrabold text-white flex items-center justify-center shrink-0"
                >−</button>
                <input
                    type="number"
                    value={qty}
                    onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 bg-transparent text-center font-extrabold text-white text-lg focus:outline-none"
                />
                <button
                    onClick={() => setQty(qty + 1)}
                    className="bg-green-600 hover:bg-green-500 w-8 h-8 rounded font-extrabold text-white flex items-center justify-center shrink-0"
                >+</button>
            </div>

            {/* Anticipo */}
            <input
                type="number"
                placeholder="Anticipo (Opcional)"
                value={anticipo || ""}
                onChange={e => setAnticipo(parseInt(e.target.value) || 0)}
                className="w-full bg-yellow-50 text-gray-900 font-bold px-4 py-2.5 rounded-lg focus:outline-none border-2 border-transparent focus:border-yellow-400 placeholder-gray-500 text-sm"
            />

            {/* FICHA / COPIAR */}
            <div className="flex gap-2">
                <button
                    onClick={() => onFicha(calc)}
                    className={`${btnGreen} flex items-center justify-center gap-1.5`}
                >
                    <ClipboardList className="w-4 h-4" /> FICHA
                </button>
                <button
                    onClick={() => navigator.clipboard.writeText(generatePresupuestoText(calc))}
                    className={`${btnBlue} flex items-center justify-center gap-1.5`}
                >
                    <ClipboardList className="w-4 h-4" /> COPIAR
                </button>
            </div>

            {/* Caja de producto */}
            {product ? (
                <div className="bg-[#131929] border border-[#2a2f3e] rounded-xl p-4">
                    <div className="text-gray-300 font-bold text-sm mb-2 leading-snug">
                        [{product.codigo}] {product.nombre}
                    </div>
                    <div className="text-white font-extrabold text-2xl leading-tight">
                        ${formatARS(calc.subtotal)}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">Stock: {product.stock}</div>
                </div>
            ) : (
                <div className="bg-[#131929] border border-[#2a2f3e] rounded-xl p-4 flex items-center justify-center min-h-[80px]">
                    <span className="text-gray-600 text-sm">Sin producto seleccionado</span>
                </div>
            )}

            {/* Cards de planes */}
            {calc.subtotal > 0 && (
                <div className="flex flex-col gap-2">
                    {calc.planStats.map((p: any) => <PlanCard key={p.id} p={p} />)}
                </div>
            )}
        </div>
    );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function CotizadorPage() {
    const [settings, setSettings] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedList, setSelectedList] = useState<string>("local");
    const [loading, setLoading] = useState(true);

    const [showRegistration, setShowRegistration] = useState(false);
    const [activeCalc, setActiveCalc] = useState<any | null>(null);

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => { if (settings) fetchProducts(selectedList); }, [selectedList, settings]);

    async function fetchInitialData() {
        setLoading(true);
        const [resPlans, resSettings] = await Promise.all([
            fetch("/api/plans").then(r => r.json()),
            fetch("/api/settings").then(r => r.json()),
        ]);
        if (resPlans.success) setPlans(resPlans.data.sort((a: any, b: any) => a.orden - b.orden).filter((p: any) => p.activo));
        if (resSettings.success) {
            setSettings(resSettings.data);
            if (resSettings.data.listas.length > 0) setSelectedList(resSettings.data.listas[0]);
        }
        setLoading(false);
    }

    async function fetchProducts(listName: string) {
        const listKey = (listName || "").trim().toLowerCase();
        const res = await fetch(`/api/products?list=${encodeURIComponent(listKey)}&_t=${Date.now()}`, {
            cache: "no-store",
        });
        const json = await res.json();
        if (json.success) setProducts(json.data);
    }

    if (loading) return <div className="p-8 text-neutral-500 text-sm">Cargando cotizador...</div>;

    return (
        <div className="w-full max-w-7xl px-4 py-4 md:px-8 flex flex-col items-center gap-6">

            {/* Selector de lista */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-[#1c2333] p-2 rounded-xl border border-[#2a2f3e]">
                    <select
                        value={selectedList}
                        onChange={e => setSelectedList(e.target.value)}
                        className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg focus:outline-none min-w-[240px] text-sm"
                    >
                        {settings?.listas.map((lst: string) => (
                            <option key={lst} value={lst}>
                                LISTA {lst.toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => fetchProducts(selectedList)}
                        className="bg-blue-700 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors"
                        title="Actualizar productos"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-green-400 font-bold text-xs flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {products.length} productos cargados
                </div>
            </div>

            {/* 3 columnas idénticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
                <CotizadorCol products={products} plans={plans} settings={settings} onFicha={(calc) => { setActiveCalc(calc); setShowRegistration(true); }} />
                <CotizadorCol products={products} plans={plans} settings={settings} onFicha={(calc) => { setActiveCalc(calc); setShowRegistration(true); }} />
                <CotizadorCol products={products} plans={plans} settings={settings} onFicha={(calc) => { setActiveCalc(calc); setShowRegistration(true); }} />
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
