/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { ClipboardList, RotateCcw, Check, Trash2 } from "lucide-react";
import { calcPlanStats, generateFichaText, formatARS } from "./utils";
import RegistrationModal from "./RegistrationModal";

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ p }: { p: any }) {
    const isContado = p.semanas === 0;
    const hasBadge = !!p.badge;

    const headerClass = isContado
        ? "bg-green-700"
        : hasBadge
        ? "bg-orange-600"
        : "bg-blue-700";

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

// ─── Product info box ─────────────────────────────────────────────────────────
function ProductBox({ product, subtotal }: { product: any | null; subtotal: number }) {
    if (!product) {
        return (
            <div className="bg-[#131929] border border-[#2a2f3e] rounded-xl p-4 min-h-[80px] flex items-center justify-center">
                <span className="text-gray-600 text-sm">Sin producto seleccionado</span>
            </div>
        );
    }
    return (
        <div className="bg-[#131929] border border-[#2a2f3e] rounded-xl p-4">
            <div className="text-gray-300 font-bold text-sm mb-2 leading-snug">
                [{product.codigo}] {product.nombre}
            </div>
            <div className="text-white font-extrabold text-2xl leading-tight">
                ${formatARS(subtotal)}
            </div>
            <div className="text-gray-500 text-xs mt-1">
                Stock: {product.stock}
            </div>
        </div>
    );
}

// ─── Column wrapper ───────────────────────────────────────────────────────────
function Column({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-[#1c2333] border border-[#2a2f3e] rounded-2xl p-4 flex flex-col gap-3">
            {children}
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CotizadorPage() {
    const [settings, setSettings] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedList, setSelectedList] = useState<string>("local");
    const [loading, setLoading] = useState(true);

    const [simpleSearch, setSimpleSearch] = useState("");
    const [cartSearch, setCartSearch] = useState("");

    const [simpleProduct, setSimpleProduct] = useState<any | null>(null);
    const [simpleQty, setSimpleQty] = useState<number>(1);
    const [simpleAnticipo, setSimpleAnticipo] = useState<number>(0);

    const [cartItems, setCartItems] = useState<any[]>([]);
    const [cartAnticipo, setCartAnticipo] = useState<number>(0);

    const [manualName, setManualName] = useState("");
    const [manualPrice, setManualPrice] = useState<number>(0);
    const [manualQty, setManualQty] = useState<number>(1);
    const [manualAnticipo, setManualAnticipo] = useState<number>(0);

    const [showRegistration, setShowRegistration] = useState(false);
    const [activeCalc, setActiveCalc] = useState<any | null>(null);
    const [activeColLabel, setActiveColLabel] = useState("");

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
        const res = await fetch(`/api/products?list=${encodeURIComponent(listName)}`);
        const json = await res.json();
        if (json.success) setProducts(json.data);
    }

    const simpleFiltered = useMemo(() => {
        const q = simpleSearch.toLowerCase().trim();
        if (!q) return products.slice(0, 100);
        return products.filter(p =>
            p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
        ).slice(0, 100);
    }, [simpleSearch, products]);

    const cartFiltered = useMemo(() => {
        const q = cartSearch.toLowerCase().trim();
        if (!q) return products.slice(0, 100);
        return products.filter(p =>
            p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)
        ).slice(0, 100);
    }, [cartSearch, products]);

    const simpleCalc = useMemo(() => {
        const subtotal = (simpleProduct?.precio || 0) * simpleQty;
        const itemsText = simpleProduct
            ? (simpleQty > 1 ? simpleQty + "x " : "") + "[" + simpleProduct.codigo + "] " + simpleProduct.nombre
            : "";
        return { subtotal, anticipo: simpleAnticipo, planStats: calcPlanStats(subtotal, simpleAnticipo, plans, settings), itemsText };
    }, [simpleProduct, simpleQty, simpleAnticipo, plans, settings]);

    const cartCalc = useMemo(() => {
        const subtotal = cartItems.reduce((acc, i) => acc + i.precio * i.qty, 0);
        const itemsText = cartItems.map(i => (i.qty > 1 ? i.qty + "x " : "") + "[" + i.codigo + "] " + i.nombre).join(", ");
        return { subtotal, anticipo: cartAnticipo, planStats: calcPlanStats(subtotal, cartAnticipo, plans, settings), itemsText };
    }, [cartItems, cartAnticipo, plans, settings]);

    const manualCalc = useMemo(() => {
        const subtotal = manualPrice * manualQty;
        const itemsText = (manualQty > 1 ? manualQty + "x " : "") + (manualName || "Producto Libre") + " ($" + manualPrice + ")";
        return { subtotal, anticipo: manualAnticipo, planStats: calcPlanStats(subtotal, manualAnticipo, plans, settings), itemsText };
    }, [manualName, manualPrice, manualQty, manualAnticipo, plans, settings]);

    if (loading) {
        return <div className="p-8 text-neutral-500 text-sm">Cargando cotizador...</div>;
    }

    // ─── shared styles ────────────────────────────────────────────────────────
    const inputSearch = "w-full bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500";
    const selectStyle = "w-full bg-white text-gray-900 font-bold rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer";
    const btnRed = "flex-1 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-extrabold py-2.5 rounded-lg text-sm tracking-wide transition-colors uppercase";
    const btnGreen = "flex-1 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-extrabold py-2.5 rounded-lg text-sm tracking-wide transition-colors uppercase";
    const btnBlue = "flex-1 bg-[#25A1ED] hover:bg-blue-400 active:bg-blue-600 text-white font-extrabold py-2.5 rounded-lg text-sm tracking-wide transition-colors uppercase";
    const anticipo = "w-full bg-yellow-50 text-gray-900 font-bold px-4 py-2.5 rounded-lg focus:outline-none border-2 border-transparent focus:border-yellow-400 placeholder-gray-500 text-sm";

    return (
        <div className="w-full max-w-7xl px-4 py-4 md:px-8 flex flex-col items-center gap-6">

            {/* Selector de lista */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-[#1c2333] p-2 rounded-xl border border-[#2a2f3e]">
                    <select
                        value={selectedList}
                        onChange={e => setSelectedList(e.target.value)}
                        className="bg-white text-gray-900 font-bold px-4 py-2 rounded-lg pr-8 focus:outline-none min-w-[280px] text-sm"
                    >
                        {settings?.listas.map((lst: string) => (
                            <option key={lst} value={lst}>
                                LISTA {lst.toUpperCase()} {settings.listaLabels?.[lst] || ""}
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

            {/* 3 columnas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">

                {/* ── Columna 1: Simple ── */}
                <Column>
                    <input
                        type="text"
                        placeholder="Buscar por código o nombre..."
                        value={simpleSearch}
                        onChange={e => setSimpleSearch(e.target.value)}
                        className={inputSearch}
                    />
                    <select
                        className={selectStyle}
                        value={simpleProduct?.codigo || ""}
                        onChange={e => {
                            const p = products.find(prod => prod.codigo === e.target.value);
                            setSimpleProduct(p || null);
                        }}
                    >
                        <option value="">Seleccione producto...</option>
                        {simpleFiltered.map(p => (
                            <option key={p.codigo} value={p.codigo}>[{p.codigo}] {p.nombre}</option>
                        ))}
                    </select>

                    <div className="flex gap-2">
                        <button onClick={() => { setSimpleProduct(null); setSimpleQty(1); setSimpleAnticipo(0); }} className={btnRed}>LIMPIAR</button>
                        <button
                            onClick={() => {
                                if (simpleProduct) alert(`Stock de "${simpleProduct.nombre}": ${simpleProduct.stock} unidades`);
                            }}
                            className={btnGreen}
                        >STOCK</button>
                    </div>

                    <div className="flex items-center gap-2 bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2">
                        <span className="text-gray-400 font-bold text-xs uppercase tracking-wide w-20">Cantidad:</span>
                        <button onClick={() => setSimpleQty(Math.max(1, simpleQty - 1))} className="bg-orange-600 hover:bg-orange-500 w-8 h-8 rounded font-extrabold text-white flex items-center justify-center shrink-0">−</button>
                        <input
                            type="number"
                            value={simpleQty}
                            onChange={e => setSimpleQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="flex-1 bg-transparent text-center font-extrabold text-white text-lg focus:outline-none"
                        />
                        <button onClick={() => setSimpleQty(simpleQty + 1)} className="bg-green-600 hover:bg-green-500 w-8 h-8 rounded font-extrabold text-white flex items-center justify-center shrink-0">+</button>
                    </div>

                    <input type="number" placeholder="Anticipo (Opcional)" value={simpleAnticipo || ""} onChange={e => setSimpleAnticipo(parseInt(e.target.value) || 0)} className={anticipo} />

                    <div className="flex gap-2">
                        <button onClick={() => { setActiveCalc(simpleCalc); setActiveColLabel("SIMPLE"); setShowRegistration(true); }} className={`${btnGreen} flex items-center justify-center gap-1.5`}>
                            <ClipboardList className="w-4 h-4" /> FICHA
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(generateFichaText(simpleCalc))} className={`${btnBlue} flex items-center justify-center gap-1.5`}>
                            <ClipboardList className="w-4 h-4" /> COPIAR
                        </button>
                    </div>

                    <ProductBox product={simpleProduct} subtotal={simpleCalc.subtotal} />

                    {simpleCalc.subtotal > 0 && (
                        <div className="flex flex-col gap-2">
                            {simpleCalc.planStats.map((p: any) => <PlanCard key={p.id} p={p} />)}
                        </div>
                    )}
                </Column>

                {/* ── Columna 2: Carrito ── */}
                <Column>
                    <input
                        type="text"
                        placeholder="Buscar por código o nombre..."
                        value={cartSearch}
                        onChange={e => setCartSearch(e.target.value)}
                        className={inputSearch}
                    />
                    <select
                        className={selectStyle}
                        value=""
                        onChange={e => {
                            const p = products.find(prod => prod.codigo === e.target.value);
                            if (p) {
                                const existing = cartItems.find(i => i.codigo === p.codigo);
                                if (existing) {
                                    setCartItems(cartItems.map(i => i.codigo === p.codigo ? { ...i, qty: i.qty + 1 } : i));
                                } else {
                                    setCartItems([...cartItems, { ...p, qty: 1 }]);
                                }
                            }
                        }}
                    >
                        <option value="">Seleccione producto...</option>
                        {cartFiltered.map(p => (
                            <option key={p.codigo} value={p.codigo}>[{p.codigo}] {p.nombre}</option>
                        ))}
                    </select>

                    <div className="flex gap-2">
                        <button onClick={() => setCartItems([])} className={btnRed}>LIMPIAR</button>
                        <button className={btnGreen}>+ AGREGAR</button>
                    </div>

                    <div className="bg-[#0d1117] border border-[#2a2f3e] rounded-lg p-2 min-h-[72px] max-h-[96px] overflow-y-auto space-y-1">
                        {cartItems.length === 0
                            ? <div className="text-gray-600 text-xs text-center py-3">Carrito vacío</div>
                            : cartItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs text-gray-300">
                                    <span className="truncate flex-1 pr-2 font-bold">[{item.codigo}] {item.qty}x {item.nombre}</span>
                                    <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400 shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))
                        }
                    </div>

                    <input type="number" placeholder="Anticipo (Opcional)" value={cartAnticipo || ""} onChange={e => setCartAnticipo(parseInt(e.target.value) || 0)} className={anticipo} />

                    <div className="flex gap-2">
                        <button onClick={() => { setActiveCalc(cartCalc); setActiveColLabel("CARRITO"); setShowRegistration(true); }} className={`${btnGreen} flex items-center justify-center gap-1.5`}>
                            <ClipboardList className="w-4 h-4" /> FICHA
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(generateFichaText(cartCalc))} className={`${btnBlue} flex items-center justify-center gap-1.5`}>
                            <ClipboardList className="w-4 h-4" /> COPIAR
                        </button>
                    </div>

                    {cartCalc.subtotal > 0 && (
                        <div className="bg-[#131929] border border-[#2a2f3e] rounded-xl p-4">
                            <div className="text-gray-300 font-bold text-sm mb-2">{cartItems.length} producto{cartItems.length !== 1 ? "s" : ""} en carrito</div>
                            <div className="text-white font-extrabold text-2xl">${formatARS(cartCalc.subtotal)}</div>
                        </div>
                    )}

                    {cartCalc.subtotal > 0 && (
                        <div className="flex flex-col gap-2">
                            {cartCalc.planStats.map((p: any) => <PlanCard key={p.id} p={p} />)}
                        </div>
                    )}
                </Column>

                {/* ── Columna 3: Manual ── */}
                <Column>
                    <input
                        type="text"
                        placeholder="Descripción del producto..."
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        className={inputSearch}
                    />

                    <div className="flex gap-2">
                        <input
                            type="number"
                            placeholder="Cant."
                            value={manualQty || ""}
                            onChange={e => setManualQty(Number(e.target.value) || 1)}
                            className="w-20 bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-white text-center text-sm focus:outline-none font-bold"
                        />
                        <input
                            type="number"
                            placeholder="$ Precio unitario"
                            value={manualPrice || ""}
                            onChange={e => setManualPrice(Number(e.target.value) || 0)}
                            className="flex-1 bg-[#0d1117] border border-[#2a2f3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                        />
                    </div>

                    <button onClick={() => { setManualName(""); setManualPrice(0); setManualAnticipo(0); setManualQty(1); }} className={btnRed}>LIMPIAR</button>

                    <input type="number" placeholder="Anticipo (Opcional)" value={manualAnticipo || ""} onChange={e => setManualAnticipo(parseInt(e.target.value) || 0)} className={anticipo} />

                    <div className="flex gap-2">
                        <button onClick={() => { setActiveCalc(manualCalc); setActiveColLabel("MANUAL"); setShowRegistration(true); }} className={`${btnGreen} flex items-center justify-center gap-1.5`}>
                            <ClipboardList className="w-4 h-4" /> FICHA
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(generateFichaText(manualCalc))} className={`${btnBlue} flex items-center justify-center gap-1.5`}>
                            <ClipboardList className="w-4 h-4" /> COPIAR
                        </button>
                    </div>

                    {manualCalc.subtotal > 0 && (
                        <div className="bg-[#131929] border border-[#2a2f3e] rounded-xl p-4">
                            <div className="text-gray-300 font-bold text-sm mb-2 leading-snug">{manualName || "Producto Libre"}</div>
                            <div className="text-white font-extrabold text-2xl">${formatARS(manualCalc.subtotal)}</div>
                        </div>
                    )}

                    {manualCalc.subtotal > 0 && (
                        <div className="flex flex-col gap-2">
                            {manualCalc.planStats.map((p: any) => <PlanCard key={p.id} p={p} />)}
                        </div>
                    )}
                </Column>

            </div>

            {showRegistration && activeCalc && (
                <RegistrationModal
                    calc={activeCalc}
                    colLabel={activeColLabel}
                    onClose={() => setShowRegistration(false)}
                />
            )}
        </div>
    );
}
