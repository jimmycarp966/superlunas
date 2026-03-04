/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ClipboardList, Share2, Loader2 } from "lucide-react";
import { generateNotaPedidoText, planToText, formatARS } from "./utils";
import type { ClientRecord } from "@/lib/types";

interface Props {
    calc: {
        subtotal: number;
        anticipo: number;
        itemsText: string;
        planStats: any[];
        selectedPlanId?: string;
    };
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
    const [vendedorTelefono, setVendedorTelefono] = useState("");
    const [selectedPlanId, setSelectedPlanId] = useState<string>("");
    const [financingMode, setFinancingMode] = useState<"plan" | "especial">("plan");
    const [specialWeeksInput, setSpecialWeeksInput] = useState("");
    const [specialAmountInput, setSpecialAmountInput] = useState("");
    const [fichaText, setFichaText] = useState("");
    const [clients, setClients] = useState<ClientRecord[]>([]);
    const [clientSearch, setClientSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch("/api/clients")
            .then(r => r.json())
            .then(json => { if (json.success) setClients(json.data); })
            .catch(() => { /* ignore */ });
    }, []);

    useEffect(() => {
        const availableIds = calc.planStats.map((p) => String(p.id));
        if (availableIds.length === 0) {
            setSelectedPlanId("");
            return;
        }

        const preferredId = String(calc.selectedPlanId || "");
        setSelectedPlanId((prev) => {
            const prevId = String(prev || "");
            if (preferredId && availableIds.includes(preferredId)) return preferredId;
            if (prevId && availableIds.includes(prevId)) return prevId;
            return availableIds[0];
        });
    }, [calc.planStats, calc.selectedPlanId]);

    const selectedPlan = calc.planStats.find(p => String(p.id) === String(selectedPlanId));

    const getAnticipoFinal = useCallback((plan: any | undefined): number => {
        const anticipoManual = Math.max(0, Number(calc.anticipo) || 0);
        const cuotaComoAnticipo = plan?.primeraCuotaPaga ? Math.max(0, Number(plan.cuota) || 0) : 0;
        return anticipoManual + cuotaComoAnticipo;
    }, [calc.anticipo]);

    const anticipoFinal = getAnticipoFinal(selectedPlan);
    const specialWeeks = Math.max(0, parseInt(specialWeeksInput, 10) || 0);
    const specialAmount = Math.max(0, parseInt(specialAmountInput, 10) || 0);
    const isSpecialFinancing = financingMode === "especial";

    useEffect(() => {
        const calcForText = { ...calc, anticipo: isSpecialFinancing ? 0 : anticipoFinal };
        setFichaText(generateNotaPedidoText(calcForText, {
            vendedor,
            vendedorTelefono,
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
            conyugue: form.conyugue,
            dniConyugue: form.dniConyugue,
            telConyugue: form.telConyugue,
            specialFinancing: isSpecialFinancing
                ? { semanas: specialWeeks, monto: specialAmount }
                : undefined,
        }));
    }, [
        calc,
        anticipoFinal,
        form,
        vendedor,
        vendedorTelefono,
        selectedPlanId,
        isSpecialFinancing,
        specialWeeks,
        specialAmount,
    ]);

    const resetFichaState = useCallback(() => {
        setForm(emptyForm());
        setVendedor("");
        setVendedorTelefono("");
        setFinancingMode("plan");
        setSpecialWeeksInput("");
        setSpecialAmountInput("");
        setClientSearch("");
        setShowDropdown(false);
        setSubmitError("");
    }, []);

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
            cliente: String(c.nombre || "").toUpperCase(),
            nroCliente: String(c.nroCliente || "").toUpperCase(),
            dni: String(c.dni || "").toUpperCase(),
            telefono: String(c.telefono || "").toUpperCase(),
            localidad: String(c.localidad || "").toUpperCase(),
            rubro: String(c.rubro || "").toUpperCase(),
            domCom: String(c.domCom || "").toUpperCase(),
            domPar: String(c.domPar || "").toUpperCase(),
            zona: String(c.zona || "").toUpperCase(),
            conyugue: String(c.conyugue || "").toUpperCase(),
            dniConyugue: String(c.dniConyugue || "").toUpperCase(),
            telConyugue: String(c.telConyugue || "").toUpperCase(),
        }));
        setClientSearch(String(c.nombre || "").toUpperCase());
        setShowDropdown(false);
    };

    const setField = (field: keyof FormState, value: string) => {
        setForm(prev => ({ ...prev, [field]: value.toUpperCase() }));
    };

    const handleClientInput = (value: string) => {
        setClientSearch(value);
        setField("cliente", value.toUpperCase());
        setShowDropdown(value.length >= 2);
    };

    const getMissingRequiredFields = useCallback((): string[] => {
        const missing: string[] = [];
        if (isSpecialFinancing) {
            if (specialWeeks <= 0) missing.push("Semanas");
            if (specialAmount <= 0) missing.push("Monto semanal");
            return missing;
        }

        if (!vendedor.trim()) missing.push("Vendedor");
        if (!vendedorTelefono.trim()) missing.push("Tel. Vendedor");
        if (!form.cliente.trim()) missing.push("Cliente");
        if (!form.dni.trim()) missing.push("DNI");
        if (!form.telefono.trim()) missing.push("Telefono");
        if (!form.localidad.trim()) missing.push("Localidad");
        if (!form.zona.trim()) missing.push("Zona");
        if (!form.rubro.trim()) missing.push("Rubro");
        if (!form.domCom.trim()) missing.push("Dom. Comercial");
        if (!form.domPar.trim()) missing.push("Dom. Particular");
        if (!form.conyugue.trim()) missing.push("Conyuge");
        if (!form.dniConyugue.trim()) missing.push("DNI conyuge");
        if (!form.telConyugue.trim()) missing.push("Tel. conyuge");
        if (!String(selectedPlanId || "").trim()) missing.push("Plan de pago");
        return missing;
    }, [isSpecialFinancing, specialWeeks, specialAmount, vendedor, vendedorTelefono, form, selectedPlanId]);

    const buildRegistrationBody = useCallback(() => {
        const planText = selectedPlan ? planToText(selectedPlan) : "";
        const totalText = selectedPlan
            ? formatARS(selectedPlan.primeraCuotaPaga ? selectedPlan.saldo : selectedPlan.calcTotal)
            : "";

        return {
            vendedor,
            vendedorTelefono,
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
            anticipo: anticipoFinal > 0 ? formatARS(anticipoFinal) : "",
            total: totalText,
            conyugue: form.conyugue,
            dniConyugue: form.dniConyugue,
            telConyugue: form.telConyugue,
            observaciones: form.observaciones,
        };
    }, [selectedPlan, vendedor, vendedorTelefono, form, calc.itemsText, anticipoFinal]);

    const saveRegistration = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
        const missing = getMissingRequiredFields();
        if (missing.length > 0) {
            return { success: false, error: `Completa los campos obligatorios: ${missing.join(", ")}.` };
        }

        setSaving(true);
        setSubmitError("");
        try {
            const body = buildRegistrationBody();
            const res = await fetch("/api/registrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.status === 401) {
                window.location.href = "/";
                return { success: false, error: "Sesion vencida. Redirigiendo al login..." };
            }
            const json = await res.json();
            if (!res.ok || !json.success) {
                return { success: false, error: json.error || "No se pudo guardar el registro." };
            }
            return { success: true };
        } catch {
            return { success: false, error: "Error de red al guardar el registro." };
        } finally {
            setSaving(false);
        }
    }, [getMissingRequiredFields, buildRegistrationBody]);

    const handleWhatsAppSend = async () => {
        if (isSpecialFinancing) {
            const missing = getMissingRequiredFields();
            if (missing.length > 0) {
                setSubmitError(`Completa los campos obligatorios: ${missing.join(", ")}.`);
                return;
            }

            setSubmitError("");
            const waUrl = `https://wa.me/?text=${encodeURIComponent(fichaText)}`;
            window.open(waUrl, "_blank");
            resetFichaState();
            onClose();
            return;
        }

        const waUrl = `https://wa.me/?text=${encodeURIComponent(fichaText)}`;
        const waWindow = window.open("", "_blank");
        const result = await saveRegistration();

        if (!result.success) {
            if (waWindow && !waWindow.closed) waWindow.close();
            setSubmitError(result.error || "No se pudo guardar el registro.");
            return;
        }

        setSubmitError("");
        if (waWindow) {
            waWindow.location.href = waUrl;
        } else {
            window.location.href = waUrl;
        }
        resetFichaState();
        onClose();
    };

    const matches = filteredClients();
    const missingRequiredFields = getMissingRequiredFields();
    const hasMissingRequiredFields = missingRequiredFields.length > 0;

    // shared input style
    const inp = "w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overscroll-contain">
            <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">

                {/* Header */}
                <div className="px-4 sm:px-6 py-4 bg-neutral-800 flex items-center justify-between border-b border-neutral-700 shrink-0">
                    <div className="flex items-center gap-2 text-white font-semibold">
                        <ClipboardList className="w-5 h-5 text-indigo-400" />
                        Ficha de Registro {colLabel ? `- ${colLabel}` : ""}
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-neutral-700 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">

                    {/* Left: form */}
                    <div className="flex-1 lg:overflow-y-auto p-4 sm:p-5 space-y-3 border-b border-neutral-800 lg:border-b-0 lg:border-r">

                        {/* Vendedor */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Vendedor <span className="text-red-400">*</span></label>
                                <input type="text" value={vendedor} onChange={e => setVendedor(e.target.value.toUpperCase())} placeholder="Nombre del vendedor..." className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Tel. Vendedor <span className="text-red-400">*</span></label>
                                <input type="text" value={vendedorTelefono} onChange={e => setVendedorTelefono(e.target.value.toUpperCase())} placeholder="Telefono del vendedor..." className={inp} />
                            </div>
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

                        {/* Nro Cliente + DNI */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Nro Cliente</label>
                                <input type="text" value={form.nroCliente} onChange={e => setField("nroCliente", e.target.value)} className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">DNI <span className="text-red-400">*</span></label>
                                <input type="text" value={form.dni} onChange={e => setField("dni", e.target.value)} className={inp} />
                            </div>
                        </div>

                        {/* Telefono + Localidad */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Telefono <span className="text-red-400">*</span></label>
                                <input type="text" value={form.telefono} onChange={e => setField("telefono", e.target.value)} className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Localidad <span className="text-red-400">*</span></label>
                                <input type="text" value={form.localidad} onChange={e => setField("localidad", e.target.value)} className={inp} />
                            </div>
                        </div>

                        {/* Zona + Rubro */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Zona <span className="text-red-400">*</span></label>
                                <input type="text" value={form.zona} onChange={e => setField("zona", e.target.value)} className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Rubro <span className="text-red-400">*</span></label>
                                <input type="text" value={form.rubro} onChange={e => setField("rubro", e.target.value)} placeholder="Despensa, Ferreteria..." className={inp} />
                            </div>
                        </div>

                        {/* Dom. Comercial + Dom. Particular */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Dom. Comercial <span className="text-red-400">*</span></label>
                                <input type="text" value={form.domCom} onChange={e => setField("domCom", e.target.value)} className={inp} />
                            </div>
                            <div>
                                <label className="text-xs text-neutral-500 mb-1 block">Dom. Particular <span className="text-red-400">*</span></label>
                                <input type="text" value={form.domPar} onChange={e => setField("domPar", e.target.value)} className={inp} />
                            </div>
                        </div>

                        {/* Conyuge */}
                        <div className="border-t border-neutral-800 pt-3">
                            <p className="text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wide">Conyuge / Co-titular</p>
                            <div className="space-y-2">
                                <input type="text" value={form.conyugue} onChange={e => setField("conyugue", e.target.value)} placeholder="Nombre del conyuge *" className={inp} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input type="text" value={form.dniConyugue} onChange={e => setField("dniConyugue", e.target.value)} placeholder="DNI conyuge *" className={inp} />
                                    <input type="text" value={form.telConyugue} onChange={e => setField("telConyugue", e.target.value)} placeholder="Tel. conyuge *" className={inp} />
                                </div>
                            </div>
                        </div>

                        {/* Observaciones */}
                        <div>
                            <label className="text-xs text-neutral-500 mb-1 block">Observaciones</label>
                            <textarea value={form.observaciones} onChange={e => setField("observaciones", e.target.value)} rows={2} className={`${inp} resize-none`} />
                        </div>

                        <p className="text-[11px] text-neutral-500">
                            {isSpecialFinancing
                                ? "Modo financiacion especial: solo se comparte por WhatsApp (sin guardar registro)."
                                : "El registro y el cliente se guardan automaticamente al enviar por WhatsApp."}
                        </p>
                    </div>

                    {/* Right: plan selector + preview */}
                    <div className="w-full lg:w-80 flex flex-col p-4 sm:p-5 gap-4 lg:overflow-y-auto shrink-0">

                        {/* Plan */}
                        <div>
                            <p className="text-xs text-neutral-500 mb-2 font-medium uppercase tracking-wide">Financiacion</p>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <button
                                    type="button"
                                    onClick={() => setFinancingMode("plan")}
                                    className={`px-2.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-colors ${
                                        !isSpecialFinancing
                                            ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200"
                                            : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700"
                                    }`}
                                >
                                    Plan normal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFinancingMode("especial")}
                                    className={`px-2.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-colors ${
                                        isSpecialFinancing
                                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                                            : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700"
                                    }`}
                                >
                                    Especial
                                </button>
                            </div>

                            {isSpecialFinancing ? (
                                <div className="space-y-2.5 bg-neutral-800 border border-neutral-700 rounded-xl p-3">
                                    <div>
                                        <label className="text-[11px] text-neutral-400 mb-1 block uppercase tracking-wide">
                                            Semanas <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={specialWeeksInput}
                                            onChange={(e) => setSpecialWeeksInput(String(Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                            className={inp}
                                            placeholder="Ej: 12"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-neutral-400 mb-1 block uppercase tracking-wide">
                                            Monto semanal <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={specialAmountInput}
                                            onChange={(e) => setSpecialAmountInput(String(Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                            className={inp}
                                            placeholder="Ej: 45000"
                                        />
                                    </div>
                                    {specialWeeks > 0 && specialAmount > 0 && (
                                        <p className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-2">
                                            Total estimado: $ {formatARS(specialWeeks * specialAmount)}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {calc.planStats.map(p => (
                                        <label key={p.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${String(selectedPlanId) === String(p.id) ? "border-indigo-500 bg-indigo-500/10" : "border-neutral-700 bg-neutral-800 hover:border-neutral-600"}`}>
                                            <input type="radio" name="plan" value={p.id} checked={String(selectedPlanId) === String(p.id)} onChange={() => setSelectedPlanId(String(p.id))} className="mt-0.5 accent-indigo-500" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-white font-medium">{p.nombre}</div>
                                                {p.semanas === 0
                                                    ? <div className="text-emerald-400 text-xs font-semibold">$ {formatARS(p.calcTotal)}</div>
                                                    : p.primeraCuotaPaga
                                                        ? <div className="text-xs text-neutral-400">1ra paga + {p.cuotasPendientes} x <span className="text-emerald-400 font-semibold">$ {formatARS(p.cuota)}</span><span className="text-neutral-500"> - saldo $ {formatARS(p.saldo)}</span></div>
                                                        : <div className="text-xs text-neutral-400">{p.semanas} x <span className="text-emerald-400 font-semibold">$ {formatARS(p.cuota)}</span><span className="text-neutral-500"> = $ {formatARS(p.calcTotal)}</span></div>
                                                }
                                                {p.badge && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">{p.badge}</span>}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Preview */}
                        <div className="flex-1 flex flex-col gap-2">
                            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Vista previa - Nota de Pedido</p>
                            <textarea
                                value={fichaText}
                                onChange={e => setFichaText(e.target.value)}
                                className="flex-1 min-h-[200px] bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-[14px] leading-6 text-neutral-200 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigator.clipboard.writeText(fichaText)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl text-xs font-medium transition-colors"
                                >
                                    <ClipboardList className="w-3.5 h-3.5" /> Copiar
                                </button>
                                <button
                                    onClick={handleWhatsAppSend}
                                    disabled={saving || hasMissingRequiredFields}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-medium transition-colors"
                                >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                                    {saving ? "Guardando..." : "WhatsApp"}
                                </button>
                            </div>
                            {hasMissingRequiredFields && (
                                <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-2">
                                    Completa obligatorios: {missingRequiredFields.join(", ")}.
                                </p>
                            )}
                            {submitError && (
                                <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-2">
                                    {submitError}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
