/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Check, Trash2, X, Share2, ClipboardList, RotateCcw } from "lucide-react";

// Helper: calcula estadísticas de planes dado subtotal y anticipo
function calcPlanStats(subtotal: number, anticipo: number, plans: any[], settings: any) {
    const roundDecimal = (num: number, decimals: number) => {
        const f = Math.pow(10, decimals);
        return Math.round(num * f) / f;
    };
    const rdTotal = settings?.redondeoTotal ?? 2;
    const rdCuota = settings?.redondeoCuota ?? 2;

    return plans.map(p => {
        let calcTotal = subtotal;
        if (p.tasaPorcentaje > 0) {
            calcTotal = subtotal * (1 + (p.tasaPorcentaje / 100));
        }
        calcTotal = roundDecimal(calcTotal, rdTotal);
        let saldo = calcTotal - anticipo;
        if (saldo < 0) saldo = 0;
        let cuota = 0;
        if (p.semanas > 0) {
            cuota = roundDecimal(saldo / p.semanas, rdCuota);
        } else {
            cuota = saldo;
        }
        return { ...p, calcTotal, saldo, cuota };
    });
}

// Helper: genera texto de ficha con TODOS los planes
function generateFichaText(calc: { subtotal: number; anticipo: number; itemsText: string; planStats: any[] }): string {
    if (calc.subtotal === 0) return "";
    const lineas = [
        `*🛒 COTIZACIÓN - LUNAS CONFORT*`,
        ``,
        `*Productos:*`,
        ...calc.itemsText.split(",").map(i => `• ${i.trim()}`),
        ``,
        `*Opciones de pago:*`,
    ];
    calc.planStats.forEach(p => {
        if (p.semanas === 0) {
            lineas.push(`💵 Contado: *$${p.calcTotal}*`);
        } else {
            lineas.push(`🗓️ ${p.semanas} cuotas semanales de *$${p.cuota}* (Total: $${p.calcTotal})`);
        }
    });
    if (calc.anticipo > 0) {
        lineas.push(``, `💰 Anticipo: $${calc.anticipo}`);
    }
    lineas.push(``, `_Cotización sujeta a modificaciones. Válido por hoy._`);
    return lineas.join("\n");
}

export default function CotizadorPage() {
    // Configuración y datos
    const [settings, setSettings] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [selectedList, setSelectedList] = useState<string>("local");
    const [loading, setLoading] = useState(true);

    // Búsquedas independientes por columna
    const [simpleSearch, setSimpleSearch] = useState("");
    const [cartSearch, setCartSearch] = useState("");

    // Estado columna 1: Simple
    const [simpleProduct, setSimpleProduct] = useState<any | null>(null);
    const [simpleQty, setSimpleQty] = useState<number>(1);
    const [simpleAnticipo, setSimpleAnticipo] = useState<number>(0);

    // Estado columna 2: Carrito
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [cartAnticipo, setCartAnticipo] = useState<number>(0);

    // Estado columna 3: Manual
    const [manualName, setManualName] = useState("");
    const [manualPrice, setManualPrice] = useState<number>(0);
    const [manualQty, setManualQty] = useState<number>(1);
    const [manualAnticipo, setManualAnticipo] = useState<number>(0);

    // Ficha
    const [showFicha, setShowFicha] = useState(false);
    const [fichaPreview, setFichaPreview] = useState("");

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (settings) {
            fetchProducts(selectedList);
        }
    }, [selectedList, settings]);

    async function fetchInitialData() {
        setLoading(true);
        const [resPlans, resSettings] = await Promise.all([
            fetch("/api/plans").then(res => res.json()),
            fetch("/api/settings").then(res => res.json()),
        ]);
        if (resPlans.success) setPlans(resPlans.data.sort((a: any, b: any) => a.orden - b.orden).filter((p: any) => p.activo));
        if (resSettings.success) {
            setSettings(resSettings.data);
            if (resSettings.data.listas.length > 0) {
                setSelectedList(resSettings.data.listas[0]);
            }
        }
        setLoading(false);
    }

    async function fetchProducts(listName: string) {
        const res = await fetch(`/api/products?list=${encodeURIComponent(listName)}`);
        const json = await res.json();
        if (json.success) {
            setProducts(json.data);
        }
    }

    // Productos filtrados independientes por columna
    const simpleFiltered = useMemo(() => {
        const q = simpleSearch.toLowerCase().trim();
        if (!q) return products.slice(0, 100);
        return products.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)).slice(0, 100);
    }, [simpleSearch, products]);

    const cartFiltered = useMemo(() => {
        const q = cartSearch.toLowerCase().trim();
        if (!q) return products.slice(0, 100);
        return products.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)).slice(0, 100);
    }, [cartSearch, products]);

    // Cálculos independientes por columna (siempre activos)
    const simpleCalc = useMemo(() => {
        const subtotal = (simpleProduct?.precio || 0) * simpleQty;
        const anticipo = simpleAnticipo;
        const itemsText = simpleProduct ? `${simpleQty}x ${simpleProduct.nombre} ($${simpleProduct.precio})` : "";
        const planStats = calcPlanStats(subtotal, anticipo, plans, settings);
        return { subtotal, anticipo, planStats, itemsText };
    }, [simpleProduct, simpleQty, simpleAnticipo, plans, settings]);

    const cartCalc = useMemo(() => {
        const subtotal = cartItems.reduce((acc, item) => acc + (item.precio * item.qty), 0);
        const anticipo = cartAnticipo;
        const itemsText = cartItems.map(i => `${i.qty}x ${i.nombre} ($${i.precio})`).join(", ");
        const planStats = calcPlanStats(subtotal, anticipo, plans, settings);
        return { subtotal, anticipo, planStats, itemsText };
    }, [cartItems, cartAnticipo, plans, settings]);

    const manualCalc = useMemo(() => {
        const subtotal = manualPrice * manualQty;
        const anticipo = manualAnticipo;
        const itemsText = `${manualQty}x ${manualName || "Producto Libre"} ($${manualPrice})`;
        const planStats = calcPlanStats(subtotal, anticipo, plans, settings);
        return { subtotal, anticipo, planStats, itemsText };
    }, [manualName, manualPrice, manualQty, manualAnticipo, plans, settings]);

    const handleStock = () => {
        if (!simpleProduct) {
            alert("Seleccione un producto primero");
            return;
        }
        alert(`Stock de "${simpleProduct.nombre}": ${simpleProduct.stock} unidades`);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const sendWhatsApp = () => {
        const encoded = encodeURIComponent(fichaPreview);
        window.open(`https://wa.me/?text=${encoded}`, "_blank");
    };

    if (loading) {
        return <div className="p-8 text-neutral-500">Cargando cotizador...</div>;
    }

    return (
        <div className="w-full max-w-7xl px-4 py-6 md:px-8 flex flex-col items-center gap-8">

            <div className="space-y-4 max-w-5xl mx-auto w-full">

                {/* Selector de lista + refresh */}
                <div className="flex flex-col items-center justify-center space-y-2 mb-8">
                    <h2 className="text-xl font-bold text-white mb-2">Cotizador</h2>
                    <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
                        <select
                            value={selectedList}
                            onChange={(e) => setSelectedList(e.target.value)}
                            className="bg-slate-100 text-slate-900 font-bold px-4 py-2 rounded-lg pr-8 focus:outline-none min-w-[280px]"
                        >
                            {settings?.listas.map((lst: string) => (
                                <option key={lst} value={lst}>
                                    LISTA {lst.toUpperCase()} {settings.listaLabels?.[lst] || ""}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => fetchProducts(selectedList)}
                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                            title="Actualizar productos"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="text-emerald-500 font-medium text-sm flex items-center gap-1">
                        <Check className="w-4 h-4" /> {products.length} productos.
                    </div>
                </div>

                {/* 3 Columnas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Columna 1: Búsqueda Simple */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex flex-col gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={simpleSearch}
                                onChange={(e) => setSimpleSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-slate-500"
                            />
                        </div>
                        <select
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                            value={simpleProduct?.codigo || ""}
                            onChange={(e) => {
                                const p = products.find(prod => prod.codigo === e.target.value);
                                setSimpleProduct(p || null);
                            }}
                        >
                            <option value="">Seleccione producto...</option>
                            {simpleFiltered.map(p => (
                                <option key={p.codigo} value={p.codigo}>{p.nombre} - ${p.precio}</option>
                            ))}
                        </select>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setSimpleProduct(null)}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                            >
                                LIMPIAR
                            </button>
                            <button
                                onClick={handleStock}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                            >
                                STOCK
                            </button>
                        </div>

                        <div className="flex gap-2 items-center bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                            <span className="text-sm font-bold text-slate-300 w-16">Cantidad:</span>
                            <div className="flex-1 flex gap-1">
                                <button
                                    onClick={() => setSimpleQty(Math.max(1, simpleQty - 1))}
                                    className="bg-red-600 w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold"
                                >-</button>
                                <input
                                    type="number"
                                    value={simpleQty}
                                    onChange={(e) => setSimpleQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full bg-slate-800 text-center font-bold text-white rounded outline-none"
                                />
                                <button
                                    onClick={() => setSimpleQty(simpleQty + 1)}
                                    className="bg-emerald-500 w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold"
                                >+</button>
                            </div>
                        </div>

                        <input
                            type="number"
                            placeholder="Anticipo (Opcional)"
                            value={simpleAnticipo || ""}
                            onChange={(e) => setSimpleAnticipo(parseInt(e.target.value) || 0)}
                            className="w-full bg-yellow-50 text-slate-900 font-bold px-4 py-2.5 rounded-lg focus:outline-none border-2 border-transparent focus:border-yellow-400 placeholder-slate-500"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const text = generateFichaText(simpleCalc);
                                    setFichaPreview(text);
                                    setShowFicha(true);
                                }}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 rounded-lg text-sm transition-colors flex justify-center items-center gap-2"
                            >
                                <ClipboardList className="w-4 h-4" /> FICHA
                            </button>
                            <button
                                onClick={() => {
                                    const text = generateFichaText(simpleCalc);
                                    copyToClipboard(text);
                                }}
                                className="flex-1 bg-[#25A1ED] hover:bg-blue-400 text-white font-bold py-2 rounded-lg text-sm transition-colors flex justify-center items-center gap-2"
                            >
                                <ClipboardList className="w-4 h-4" /> COPIAR
                            </button>
                        </div>

                        {/* Price box: siempre activo para esta columna */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 border-l-4 border-l-yellow-400 min-h-[100px]">
                            <div className="text-yellow-400 text-lg font-bold">
                                -
                                <br />
                                ${simpleCalc.subtotal > 0 ? simpleCalc.subtotal : 0}
                            </div>
                            {simpleCalc.subtotal > 0 && (
                                <div className="space-y-1 mt-2">
                                    {simpleCalc.planStats.filter(p => p.semanas > 0).slice(0, 3).map((p: any) => (
                                        <div key={p.id} className="text-white text-sm font-medium">
                                            {p.semanas} pagos semanales de <span className="text-emerald-400 font-bold">${p.cuota}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Columna 2: Carrito */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex flex-col gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={cartSearch}
                                onChange={(e) => setCartSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-slate-500"
                            />
                        </div>
                        <select
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                            onChange={(e) => {
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
                            value=""
                        >
                            <option value="">Seleccione producto...</option>
                            {cartFiltered.map(p => (
                                <option key={p.codigo} value={p.codigo}>{p.nombre} - ${p.precio}</option>
                            ))}
                        </select>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setCartItems([])}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                            >
                                LIMPIAR
                            </button>
                            <button className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 rounded-lg text-sm transition-colors">
                                + AGREGAR
                            </button>
                        </div>

                        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700 h-[72px] overflow-y-auto space-y-1">
                            {cartItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                                    <span className="truncate flex-1 pr-2">{item.qty}x {item.nombre}</span>
                                    <button
                                        onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))}
                                        className="text-red-400"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {cartItems.length === 0 && <div className="text-slate-500 text-xs text-center py-2">Carrito vacío</div>}
                        </div>

                        <input
                            type="number"
                            placeholder="Anticipo (Opcional)"
                            value={cartAnticipo || ""}
                            onChange={(e) => setCartAnticipo(parseInt(e.target.value) || 0)}
                            className="w-full bg-yellow-50 text-slate-900 font-bold px-4 py-2.5 rounded-lg focus:outline-none border-2 border-transparent focus:border-yellow-400 placeholder-slate-500 mt-auto"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const text = generateFichaText(cartCalc);
                                    setFichaPreview(text);
                                    setShowFicha(true);
                                }}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 rounded-lg text-sm transition-colors flex justify-center items-center gap-2"
                            >
                                <ClipboardList className="w-4 h-4" /> FICHA
                            </button>
                            <button
                                onClick={() => {
                                    const text = generateFichaText(cartCalc);
                                    copyToClipboard(text);
                                }}
                                className="flex-1 bg-[#25A1ED] hover:bg-blue-400 text-white font-bold py-2 rounded-lg text-sm transition-colors flex justify-center items-center gap-2"
                            >
                                <ClipboardList className="w-4 h-4" /> COPIAR
                            </button>
                        </div>

                        {/* Price box: siempre activo para esta columna */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 border-l-4 border-l-yellow-400 min-h-[100px]">
                            <div className="text-yellow-400 text-lg font-bold">
                                -
                                <br />
                                ${cartCalc.subtotal > 0 ? cartCalc.subtotal : 0}
                            </div>
                            {cartCalc.subtotal > 0 && (
                                <div className="space-y-1 mt-2">
                                    {cartCalc.planStats.filter(p => p.semanas > 0).slice(0, 3).map((p: any) => (
                                        <div key={p.id} className="text-white text-sm font-medium">
                                            {p.semanas} pagos semanales de <span className="text-emerald-400 font-bold">${p.cuota}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Columna 3: Manual */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex flex-col gap-4">
                        <div className="relative">
                            <ClipboardList className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Descripción..."
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-900/50 border border-slate-700 border-dashed rounded-lg text-white text-sm focus:outline-none focus:border-slate-500"
                            />
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="1"
                                value={manualQty || ""}
                                onChange={(e) => setManualQty(Number(e.target.value) || 1)}
                                className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-center text-sm focus:outline-none"
                            />
                            <input
                                type="number"
                                placeholder="$ Unitario..."
                                value={manualPrice || ""}
                                onChange={(e) => setManualPrice(Number(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => { setManualName(""); setManualPrice(0); setManualAnticipo(0); setManualQty(1); }}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                            >
                                LIMPIAR
                            </button>
                        </div>

                        <input
                            type="number"
                            placeholder="Anticipo (Opcional)"
                            value={manualAnticipo || ""}
                            onChange={(e) => setManualAnticipo(parseInt(e.target.value) || 0)}
                            className="w-full bg-yellow-50 text-slate-900 font-bold px-4 py-2.5 rounded-lg focus:outline-none border-2 border-transparent focus:border-yellow-400 placeholder-slate-500"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const text = generateFichaText(manualCalc);
                                    setFichaPreview(text);
                                    setShowFicha(true);
                                }}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-2 rounded-lg text-sm transition-colors flex justify-center items-center gap-2"
                            >
                                <ClipboardList className="w-4 h-4" /> FICHA
                            </button>
                            <button
                                onClick={() => {
                                    const text = generateFichaText(manualCalc);
                                    copyToClipboard(text);
                                }}
                                className="flex-1 bg-[#25A1ED] hover:bg-blue-400 text-white font-bold py-2 rounded-lg text-sm transition-colors flex justify-center items-center gap-2"
                            >
                                <ClipboardList className="w-4 h-4" /> COPIAR
                            </button>
                        </div>

                        {/* Price box: siempre activo para esta columna */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 border-l-4 border-l-yellow-400 min-h-[100px]">
                            <div className="text-yellow-400 text-lg font-bold">
                                -
                                <br />
                                ${manualCalc.subtotal > 0 ? manualCalc.subtotal : 0}
                            </div>
                            {manualCalc.subtotal > 0 && (
                                <div className="space-y-1 mt-2">
                                    {manualCalc.planStats.filter(p => p.semanas > 0).slice(0, 3).map((p: any) => (
                                        <div key={p.id} className="text-white text-sm font-medium">
                                            {p.semanas} pagos semanales de <span className="text-emerald-400 font-bold">${p.cuota}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* MODAL DE FICHA */}
            {showFicha && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-5 py-4 bg-neutral-800 flex items-center justify-between border-b border-neutral-700">
                            <div className="flex items-center gap-2 text-white font-semibold">
                                <ClipboardList className="w-5 h-5" />
                                Ficha de Pedido
                            </div>
                            <button
                                onClick={() => setShowFicha(false)}
                                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-700 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1">
                            <textarea
                                value={fichaPreview}
                                onChange={(e) => setFichaPreview(e.target.value)}
                                className="w-full h-64 bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-sm text-neutral-300 focus:outline-none focus:border-blue-500 resize-none font-sans"
                            />
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => copyToClipboard(fichaPreview)}
                                    className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    Copiar Texto
                                </button>
                                <button
                                    onClick={sendWhatsApp}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    <Share2 className="w-4 h-4" />
                                    WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
