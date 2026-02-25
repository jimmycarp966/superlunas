/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ClipboardList, Share2, Save, Check } from "lucide-react";
import { generateNotaPedidoText, planToText, formatARS } from "./utils";
import type { ClientRecord } from "@/lib/types";

interface Props {
    calc: { subtotal: number; anticipo: number; itemsText: string; planStats: any[] };
    colLabel: string;
    onClose: () => void;
}

interface FormState {
    cliente: string;
    nroCliente: string;
    dni: string;
    telefono: string;
    localidad: string;
    rubro: string;
    domCom: string;
    domPar: string;
    zona: string;
    conyugue: string;
    dniConyugue: string;
    telConyugue: string;
    observaciones: string;
}

const FORM_KEY = "lunas_registro_form";
const VENDOR_KEY = "lunas_vendedor";

const emptyForm = (): FormState => ({
    cliente: "",
    nroCliente: "",
    dni: "",
    telefono: "",
    localidad: "",
    rubro: "",
    domCom: "",
    domPar: "",
    zona: "",
    conyugue: "",
    dniConyugue: "",
    telConyugue: "",
    observaciones: "",
});

export default function RegistrationModal({ calc, colLabel, onClose }: Props) {
    const [form, setForm] = useState<FormState>(emptyForm());
    const [vendedor, setVendedor] = useState("");
    const [selectedPlanId, setSelectedPlanId] = useState<string>("");
    const [fichaText, setFichaText] = useState("");
    const [clients, setClients] = useState<ClientRecord[]>([]);
    const [clientSearch, setClientSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(FORM_KEY);
            if (raw) setForm(JSON.parse(raw));
        } catch { /* ignore */ }
        try {
            const v = localStorage.getItem(VENDOR_KEY);
            if (v) setVendedor(v);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        fetch("/api/clients")
            .then(r => r.json())
            .then(json => { if (json.success) setClients(json.data); })
            .catch(() => { /* ignore */ });
    }, []);

    useEffect(() => {
        if (calc.planStats.length > 0 && !selectedPlanId) {
            setSelectedPlanId(calc.planStats[0].id);
        }
    }, [calc.planStats, selectedPlanId]);

    useEffect(() => {
        setFichaText(generateNotaPedidoText(calc, {
            vendedor,
            zona: form.zona,
            cliente: form.cliente,
            nroCliente: form.nroCliente,
            dni: form.dni,
            telefono: form.telefono,
            localidad: form.localidad,
            rubro: form.rubro,
            domCom: form.domCom,
            domPar: form.domPar,
            selectedPlanId,
        }));
    }, [calc, form, vendedor, selectedPlanId]);

    useEffect(() => {
        try { localStorage.setItem(FORM_KEY, JSON.stringify(form)); } catch { /* ignore */ }
    }, [form]);

    useEffect(() => {
        try { localStorage.setItem(VENDOR_KEY, vendedor); } catch { /* ignore */ }
    }, [vendedor]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        if (typeof document === "undefined") return;
        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prevBodyOverflow;
            document.documentElement.style.overflow = prevHtmlOverflow;
        };
    }, []);

    const filteredClients = useCallback(() => {
        if (clientSearch.length < 2) return [];
        const q = clientSearch.toLowerCase();
        return clients.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 8);
    }, [clientSearch, clients]);

    const selectClient = (c: ClientRecord) => {
        setForm(prev => ({
            ...prev,
            cliente: c.nombre,
            nroCliente: c.nroCliente,
            dni: c.dni,
            telefono: c.telefono,
            localidad: c.localidad,
            rubro: c.rubro,
            domCom: c.domCom,
            domPar: c.domPar,
            zona: c.zona,
            conyugue: c.conyugue,
            dniConyugue: c.dniConyugue,
            telConyugue: c.telConyugue,
        }));
        setClientSearch(c.nombre);
        setShowDropdown(false);
    };

    const setField = (field: keyof FormState, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleClientInput = (value: string) => {
        setClientSearch(value);
        setField("cliente", value.toUpperCase());
        setShowDropdown(value.length >= 2);
    };

    const selectedPlan = calc.planStats.find(p => p.id === selectedPlanId);

    const handleSave = async () => {
        if (!form.cliente.trim()) return;
        setSaving(true);
        try {
            const planText = selectedPlan ? planToText(selectedPlan) : "";
            const totalText = selectedPlan
                ? formatARS(selectedPlan.primeraCuotaPaga ? selectedPlan.saldo : selectedPlan.calcTotal)
                : "";
            const body = {
                vendedor,
                zona: form.zona,
                cliente: form.cliente,
                nroCliente: form.nroCliente,
                dni: form.dni,
                telefono: form.telefono,
                localidad: form.localidad,
                rubro: form.rubro,
                domCom: form.domCom,
                domPar: form.domPar,
                productos: calc.itemsText,
                planes: planText,
                anticipo: calc.anticipo > 0 ? formatARS(calc.anticipo) : "",
                total: totalText,
                conyugue: form.conyugue,
                dniConyugue: form.dniConyugue,
                telConyugue: form.telConyugue,
                observaciones: form.observaciones,
            };
            const res = await fetch("/api/registrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (json.success) {
                setSaved(true);
                setForm(emptyForm());
                setClientSearch("");
                localStorage.removeItem(FORM_KEY);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch { /* ignore */ } finally {
            setSaving(false);
        }
    };

    const matches = filteredClients();

    // ── shared input style ──
    const inp = "w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overscroll-contain">
            <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">

                {/* Header */}
                <div className="px-4 sm:px-6 py-4 bg-neutral-800 flex items-center justify-between border-b border-neutral-700 shrink-0">
                    <div className="flex items-center gap-2 text-white font-semibold">
                        <ClipboardList className="w-5 h-5 text-indigo-400" />
                        Ficha de Registro {colLabel ? `— ${colLabel}` : ""}
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-700 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">

                    {/* Left: form */}
                    <div className="flex-1 lg:overflow-y-auto p-4 sm:p-5 space-y-3 border-b border-neutral-800 lg:border-b-0 lg:border-r">

                        {/* Vendedor */}
                        <div>
                            <label className="text-xs text-neutral-500 mb-1 block">Vendedor</label>
                            <input type="text" value={vendedor} onChange={e => setVendedor(e.target.value.toUpperCase())} placeholder="Nombre del vendedor..." className={inp} />
                        </div>

                        {/* Cliente */}
                        <div ref={dropdownRef} className="relative">
                            <label className="text-xs text-neutral-500 mb-1 block">Cliente <span className="text-red-400">*</span></label>
                            <input
                                type="text"
                                value={clientSearch}
                                onChange={e => handleClientInput(e.target.value)}
                                onFocus={() => clientSearch.length >= 2 && setShowDropdown(true)}
                                placeholder="Nombre del cliente..."
                                className={inp}
                            />
                            {showDropdown && matches.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
                                    {matches.map(c => (
                                        <button key={c.nombre} onClick={() => selectClient(c)} className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors">
                                            <span className="font-medium">{c.nombre}</span>
                                            {c.localidad && <span className="text-neutral-500 ml-2 text-xs">{c.localidad}</span>}
                                            {c.dni && <span className="text-neutral-500 ml-2 text-xs">DNI: {c.dni}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* N° Cliente + DNI */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">N° Cliente</label>
                                <input type="text" value={form.nroCliente} onChange={e => setField("nroCliente", e.target.value)} className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">DNI</label>
                                <input type="text" value={form.dni} onChange={e => setField("dni", e.target.value)} className={inp} />
                            </div>
                        </div>

                        {/* Teléfono + Localidad */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Teléfono</label>
                                <input type="text" value={form.telefono} onChange={e => setField("telefono", e.target.value)} className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Localidad</label>
                                <input type="text" value={form.localidad} onChange={e => setField("localidad", e.target.value)} className={inp} />
                            </div>
                        </div>

                        {/* Zona + Rubro */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Zona</label>
                                <input type="text" value={form.zona} onChange={e => setField("zona", e.target.value)} className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Rubro</label>
                                <input type="text" value={form.rubro} onChange={e => setField("rubro", e.target.value)} placeholder="Despensa, Ferretería..." className={inp} />
                            </div>
                        </div>

                        {/* Dom. Comercial + Dom. Particular */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Dom. Comercial</label>
                                <input type="text" value={form.domCom} onChange={e => setField("domCom", e.target.value)} className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Dom. Particular</label>
                                <input type="text" value={form.domPar} onChange={e => setField("domPar", e.target.value)} className={inp} />
                            </div>
                        </div>

                        {/* Cónyuge */}
                        <div className="border-t border-neutral-800 pt-3">
                            <p className="text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wide">Cónyuge / Co-titular</p>
                            <div className="space-y-2">
                                <input type="text" value={form.conyugue} onChange={e => setField("conyugue", e.target.value)} placeholder="Nombre del cónyuge" className={inp} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input type="text" value={form.dniConyugue} onChange={e => setField("dniConyugue", e.target.value)} placeholder="DNI cónyuge" className={inp} />
                                    <input type="text" value={form.telConyugue} onChange={e => setField("telConyugue", e.target.value)} placeholder="Tel. cónyuge" className={inp} />
                                </div>
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div>
                            <label className="text-xs text-neutral-500 mb-1 block">Observaciones</label>
                            <textarea value={form.observaciones} onChange={e => setField("observaciones", e.target.value)} rows={2} className={`${inp} resize-none`} />
                        </div>

                        {/* Guardar */}
                        <button
                            onClick={handleSave}
                            disabled={!form.cliente.trim() || saving}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors"
                        >
                            {saved ? <><Check className="w-4 h-4" /> ¡Guardado!</> : saving ? "Guardando..." : <><Save className="w-4 h-4" /> Guardar Registro</>}
                        </button>
                    </div>

                    {/* Right: plan selector + preview */}
                    <div className="w-full lg:w-80 flex flex-col p-4 sm:p-5 gap-4 lg:overflow-y-auto shrink-0">

                        {/* Plan */}
                        <div>
                            <p className="text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wide">Plan de pago</p>
                            <div className="space-y-2">
                                {calc.planStats.map(p => (
                                    <label key={p.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedPlanId === p.id ? "border-indigo-500 bg-indigo-500/10" : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"}`}>
                                        <input type="radio" name="plan" value={p.id} checked={selectedPlanId === p.id} onChange={() => setSelectedPlanId(p.id)} className="mt-0.5 accent-indigo-500" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white font-medium">{p.nombre}</div>
                                            {p.semanas === 0
                                                ? <div className="text-emerald-400 text-xs font-semibold">$ {formatARS(p.calcTotal)}</div>
                                                : p.primeraCuotaPaga
                                                    ? <div className="text-xs text-neutral-400">1ra paga + {p.cuotasPendientes} x <span className="text-emerald-400 font-semibold">$ {formatARS(p.cuota)}</span><span className="text-neutral-500"> · saldo $ {formatARS(p.saldo)}</span></div>
                                                    : <div className="text-xs text-neutral-400">{p.semanas} x <span className="text-emerald-400 font-semibold">$ {formatARS(p.cuota)}</span><span className="text-neutral-500"> = $ {formatARS(p.calcTotal)}</span></div>
                                            }
                                            {p.badge && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">{p.badge}</span>}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex-1 flex flex-col gap-2">
                            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Vista previa — Nota de Pedido</p>
                            <textarea
                                value={fichaText}
                                onChange={e => setFichaText(e.target.value)}
                                className="flex-1 min-h-[200px] bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigator.clipboard.writeText(fichaText)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl text-xs font-medium transition-colors"
                                >
                                    <ClipboardList className="w-3.5 h-3.5" /> Copiar
                                </button>
                                <button
                                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(fichaText)}`, "_blank")}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors"
                                >
                                    <Share2 className="w-3.5 h-3.5" /> WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
