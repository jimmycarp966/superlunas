"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
    Settings, RefreshCw, Upload, Lock, FileText,
    CheckCircle, AlertTriangle, Database, CreditCard,
    SlidersHorizontal, X, ArrowLeft, Plus, Trash2,
    ChevronRight, Loader2, Users,
} from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
    type: ToastType;
    message: string;
}

export default function AdminPanel() {
    const [tab, setTab] = useState<"origen" | "planes" | "ajustes" | "registros" | "clientes">("origen");
    const [sourceStatus, setSourceStatus] = useState<any>(null);
    const [loadingRefresh, setLoadingRefresh] = useState(false);
    const [loadingUpload, setLoadingUpload] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [toast, setToast] = useState<Toast | null>(null);

    const [settings, setSettings] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [savingSettings, setSavingSettings] = useState(false);
    const [savingPlans, setSavingPlans] = useState(false);

    // Registros tab state
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [loadingRegistrations, setLoadingRegistrations] = useState(false);
    const [expandedRegId, setExpandedRegId] = useState<string | null>(null);

    // Clientes tab state
    const [clientsFile, setClientsFile] = useState<File | null>(null);
    const clientsFileRef = useRef<HTMLInputElement>(null);
    const [loadingClientsUpload, setLoadingClientsUpload] = useState(false);
    const [allClients, setAllClients] = useState<any[]>([]);
    const [clientsSearch, setClientsSearch] = useState("");
    const [clientsPage, setClientsPage] = useState(0);
    const [loadingClients, setLoadingClients] = useState(false);
    const [expandedClientNombre, setExpandedClientNombre] = useState<string | null>(null);

    // Catálogo - borrar
    const [clearingCatalog, setClearingCatalog] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);

    const CLIENTS_PER_PAGE = 50;

    useEffect(() => {
        fetchStatus();
        fetchSettings();
        fetchPlans();
    }, []);

    useEffect(() => {
        if (tab === "registros") {
            fetchRegistrations();
        } else if (tab === "clientes") {
            fetchClientsPreview();
        }
    }, [tab]);

    const showToast = (type: ToastType, message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchStatus = async () => {
        try {
            const res = await fetch("/api/source/refresh");
            const data = await res.json();
            if (data.success) setSourceStatus(data);
        } catch { }
    };

    const fetchSettings = async () => {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success) setSettings(json.data);
    };

    const fetchPlans = async () => {
        const res = await fetch("/api/plans");
        const json = await res.json();
        if (json.success) setPlans(json.data.sort((a: any, b: any) => a.orden - b.orden));
    };

    const fetchRegistrations = async () => {
        setLoadingRegistrations(true);
        try {
            const res = await fetch("/api/registrations");
            const json = await res.json();
            if (json.success) setRegistrations(json.data);
        } catch { } finally {
            setLoadingRegistrations(false);
        }
    };

    const fetchClientsPreview = async () => {
        setLoadingClients(true);
        try {
            const res = await fetch("/api/clients");
            const json = await res.json();
            if (json.success) {
                setAllClients(json.data);
                setClientsPage(0);
            }
        } catch { } finally {
            setLoadingClients(false);
        }
    };

    const handleClearCatalog = async () => {
        setClearingCatalog(true);
        try {
            const res = await fetch("/api/source/refresh", { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setSourceStatus(null);
                setConfirmClear(false);
                showToast("success", "Catálogo eliminado correctamente");
            } else {
                showToast("error", data.error || "Error al eliminar el catálogo");
            }
        } catch {
            showToast("error", "Error de conexión");
        } finally {
            setClearingCatalog(false);
        }
    };

    const handleRefreshSource = async () => {
        setLoadingRefresh(true);
        try {
            const res = await fetch("/api/source/refresh", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                await fetchStatus();
                showToast("success", "Catálogo recargado correctamente");
            } else {
                showToast("error", data.error || "Error al recargar");
            }
        } catch {
            showToast("error", "Error de conexión");
        } finally {
            setLoadingRefresh(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append("file", selectedFile);
        setLoadingUpload(true);
        try {
            const res = await fetch("/api/source/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                showToast("success", `Archivo cargado. ${data.itemsCount} productos en catálogo.`);
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                await fetchStatus();
            } else {
                showToast("error", data.error || "Error al subir el archivo");
            }
        } catch (err: any) {
            showToast("error", "Error de conexión: " + err.message);
        } finally {
            setLoadingUpload(false);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (res.ok) {
                showToast("success", "Ajustes guardados correctamente");
            } else {
                showToast("error", "Error al guardar ajustes");
            }
        } catch {
            showToast("error", "Error de conexión");
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSavePlans = async () => {
        setSavingPlans(true);
        try {
            const res = await fetch("/api/plans", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(plans),
            });
            if (res.ok) {
                showToast("success", "Planes guardados correctamente");
            } else {
                showToast("error", "Error al guardar planes");
            }
        } catch {
            showToast("error", "Error de conexión");
        } finally {
            setSavingPlans(false);
        }
    };

    const updatePlan = (i: number, field: string, value: any) => {
        setPlans(plans.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
    };

    const removePlan = (i: number) => {
        setPlans(plans.filter((_, idx) => idx !== i));
    };

    const handleClientsFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setClientsFile(e.target.files[0]);
    };

    const handleClientsUpload = async () => {
        if (!clientsFile) return;
        const formData = new FormData();
        formData.append("file", clientsFile);
        setLoadingClientsUpload(true);
        try {
            const res = await fetch("/api/clients", { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                setClientsFile(null);
                if (clientsFileRef.current) clientsFileRef.current.value = "";
                await fetchClientsPreview();
                showToast("success", `${data.count} clientes cargados correctamente`);
            } else {
                showToast("error", data.error || "Error al subir el archivo");
            }
        } catch (err: any) {
            showToast("error", "Error: " + err.message);
        } finally {
            setLoadingClientsUpload(false);
        }
    };

    const navItems = [
        { id: "origen", label: "Catálogo", icon: Database },
        { id: "planes", label: "Planes de Pago", icon: CreditCard },
        { id: "ajustes", label: "Ajustes", icon: SlidersHorizontal },
        { id: "registros", label: "Registros", icon: FileText },
        { id: "clientes", label: "Clientes", icon: Users },
    ];

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
        } catch {
            return iso;
        }
    };

    const filteredClients = useMemo(() => {
        const q = clientsSearch.toLowerCase().trim();
        if (!q) return allClients;
        return allClients.filter(c =>
            c.nombre?.toLowerCase().includes(q) ||
            c.dni?.toLowerCase().includes(q) ||
            c.nroCliente?.toLowerCase().includes(q) ||
            c.telefono?.toLowerCase().includes(q) ||
            c.localidad?.toLowerCase().includes(q) ||
            c.zona?.toLowerCase().includes(q) ||
            c.rubro?.toLowerCase().includes(q)
        );
    }, [allClients, clientsSearch]);

    const totalClientPages = Math.ceil(filteredClients.length / CLIENTS_PER_PAGE);
    const paginatedClients = filteredClients.slice(clientsPage * CLIENTS_PER_PAGE, (clientsPage + 1) * CLIENTS_PER_PAGE);

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-200">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all
                    ${toast.type === "success" ? "bg-emerald-900/90 border-emerald-700 text-emerald-200" : ""}
                    ${toast.type === "error" ? "bg-red-900/90 border-red-700 text-red-200" : ""}
                    ${toast.type === "info" ? "bg-blue-900/90 border-blue-700 text-blue-200" : ""}
                `}>
                    {toast.type === "success" && <CheckCircle className="w-4 h-4 shrink-0" />}
                    {toast.type === "error" && <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {toast.message}
                    <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header */}
            <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Settings className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-white leading-tight">Panel Admin</h1>
                            <p className="text-neutral-500 text-xs">Luna&apos;s Confort</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href="/cotizador"
                            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-800"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Cotizador
                        </a>
                        <form action="/api/auth/logout" method="POST">
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                <Lock className="w-4 h-4" />
                                Salir
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto p-6 md:p-8 flex flex-col md:flex-row gap-8">

                {/* Sidebar */}
                <nav className="w-full md:w-52 flex-shrink-0">
                    <div className="flex flex-col gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = tab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setTab(item.id as any)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left
                                        ${active
                                            ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30"
                                            : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-indigo-400" : ""}`} />
                                    {item.label}
                                    {active && <ChevronRight className="w-3 h-3 ml-auto text-indigo-400" />}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* Contenido */}
                <div className="flex-1 min-w-0">

                    {/* ── TAB: CATÁLOGO ── */}
                    {tab === "origen" && (
                        <div className="space-y-5">
                            <h2 className="text-xl font-bold text-white">Catálogo de Productos</h2>

                            {/* Estado actual */}
                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        {sourceStatus?.status === "ready"
                                            ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                                            : <AlertTriangle className="w-5 h-5 text-amber-400" />
                                        }
                                        <h3 className="font-semibold text-white">Estado del catálogo</h3>
                                    </div>
                                    <button
                                        onClick={handleRefreshSource}
                                        disabled={loadingRefresh}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loadingRefresh ? "animate-spin" : ""}`} />
                                        Recargar
                                    </button>
                                </div>

                                {sourceStatus ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="bg-neutral-800 rounded-xl p-3 border border-neutral-700">
                                            <p className="text-neutral-500 text-xs mb-1">Productos</p>
                                            <p className="text-2xl font-bold text-white">{sourceStatus.itemsCount ?? 0}</p>
                                        </div>
                                        <div className="bg-neutral-800 rounded-xl p-3 border border-neutral-700">
                                            <p className="text-neutral-500 text-xs mb-1">Última carga</p>
                                            <p className="text-sm font-semibold text-white">
                                                {sourceStatus.updatedAt
                                                    ? new Date(sourceStatus.updatedAt).toLocaleTimeString("es-AR")
                                                    : "—"}
                                            </p>
                                        </div>
                                        <div className="bg-neutral-800 rounded-xl p-3 border border-neutral-700 col-span-2 md:col-span-1">
                                            <p className="text-neutral-500 text-xs mb-1">Versión</p>
                                            <p className="text-xs font-mono text-neutral-300 truncate">
                                                {sourceStatus.sourceVersion || "—"}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-neutral-500 text-sm">Sin datos en caché todavía.</p>
                                )}
                            </div>

                            {/* Borrar catálogo */}
                            <div className="bg-neutral-900 border border-red-900/30 rounded-2xl p-5">
                                <h3 className="font-semibold text-white mb-1">Borrar catálogo actual</h3>
                                <p className="text-neutral-500 text-sm mb-4">
                                    Elimina el catálogo en memoria. Los productos no estarán disponibles hasta que se suba una nueva lista.
                                </p>
                                {!confirmClear ? (
                                    <button
                                        onClick={() => setConfirmClear(true)}
                                        disabled={!sourceStatus || sourceStatus.status !== "ready"}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Borrar catálogo
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <p className="text-red-400 text-sm font-medium">¿Confirmar borrado?</p>
                                        <button
                                            onClick={handleClearCatalog}
                                            disabled={clearingCatalog}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {clearingCatalog ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                            Sí, borrar
                                        </button>
                                        <button
                                            onClick={() => setConfirmClear(false)}
                                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Upload */}
                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                                <h3 className="font-semibold text-white mb-1">Subir nueva lista de precios</h3>
                                <p className="text-neutral-500 text-sm mb-4">
                                    Acepta archivos <span className="text-neutral-300">.pdf</span> o <span className="text-neutral-300">.xlsx</span>. El catálogo se actualiza en memoria al instante.
                                </p>

                                <label className={`
                                    relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer
                                    ${selectedFile
                                        ? "border-indigo-500/60 bg-indigo-500/5 py-5"
                                        : "border-neutral-700 hover:border-indigo-500/40 hover:bg-neutral-800/40 py-10"
                                    }
                                    ${loadingUpload ? "pointer-events-none opacity-50" : ""}
                                `}>
                                    {selectedFile ? (
                                        <div className="flex items-center gap-3 px-4">
                                            <FileText className="w-8 h-8 text-indigo-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-white font-medium text-sm truncate">{selectedFile.name}</p>
                                                <p className="text-neutral-500 text-xs">
                                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setSelectedFile(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                                }}
                                                className="ml-auto p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-center px-4">
                                            <Upload className="w-8 h-8 text-neutral-600" />
                                            <p className="text-sm text-neutral-400">
                                                <span className="text-indigo-400 font-medium">Clic para seleccionar</span> o arrastrá el archivo aquí
                                            </p>
                                            <p className="text-xs text-neutral-600">.pdf · .xlsx</p>
                                        </div>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.xlsx"
                                        onChange={handleFileSelect}
                                    />
                                </label>

                                {selectedFile && (
                                    <button
                                        onClick={handleUpload}
                                        disabled={loadingUpload}
                                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-colors"
                                    >
                                        {loadingUpload
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                                            : <><Upload className="w-4 h-4" /> Subir y actualizar catálogo</>
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── TAB: PLANES ── */}
                    {tab === "planes" && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">Planes de Pago</h2>
                                <button
                                    onClick={handleSavePlans}
                                    disabled={savingPlans}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    {savingPlans ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Guardar
                                </button>
                            </div>

                            <div className="space-y-3">
                                {plans.map((plan, i) => (
                                    <div key={plan.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <div className="flex-1 min-w-[140px]">
                                                <label className="text-xs text-neutral-500 mb-1 block">Nombre</label>
                                                <input
                                                    type="text"
                                                    value={plan.nombre}
                                                    onChange={(e) => updatePlan(i, "nombre", e.target.value)}
                                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <label className="text-xs text-neutral-500 mb-1 block">Semanas</label>
                                                <input
                                                    type="number"
                                                    value={plan.semanas}
                                                    onChange={(e) => updatePlan(i, "semanas", Number(e.target.value))}
                                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <label className="text-xs text-neutral-500 mb-1 block">Tasa %</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={plan.tasaPorcentaje}
                                                        onChange={(e) => updatePlan(i, "tasaPorcentaje", Number(e.target.value))}
                                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-indigo-500 pr-6"
                                                    />
                                                    <span className="absolute right-2 top-2 text-neutral-500 text-xs">%</span>
                                                </div>
                                            </div>
                                            <div className="w-32">
                                                <label className="text-xs text-neutral-500 mb-1 block">Badge</label>
                                                <input
                                                    type="text"
                                                    value={plan.badge || ""}
                                                    placeholder="Ej: Promo"
                                                    onChange={(e) => updatePlan(i, "badge", e.target.value)}
                                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <div className="w-16">
                                                <label className="text-xs text-neutral-500 mb-1 block">Orden</label>
                                                <input
                                                    type="number"
                                                    value={plan.orden}
                                                    onChange={(e) => updatePlan(i, "orden", Number(e.target.value))}
                                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <label className="text-xs text-neutral-500">Activo</label>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={plan.activo}
                                                        onChange={(e) => updatePlan(i, "activo", e.target.checked)}
                                                    />
                                                    <div className="w-10 h-5 bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500 relative"></div>
                                                </label>
                                            </div>
                                            <button
                                                onClick={() => removePlan(i)}
                                                className="mt-4 p-2 text-neutral-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setPlans([...plans, {
                                    id: Date.now().toString(),
                                    nombre: "Nuevo Plan",
                                    semanas: 10,
                                    tasaPorcentaje: 0,
                                    activo: true,
                                    orden: plans.length + 1,
                                }])}
                                className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1"
                            >
                                <Plus className="w-4 h-4" /> Agregar plan
                            </button>
                        </div>
                    )}

                    {/* ── TAB: AJUSTES ── */}
                    {tab === "ajustes" && settings && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">Ajustes Generales</h2>
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={savingSettings}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Guardar
                                </button>
                            </div>

                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">Listas disponibles</label>
                                    <p className="text-neutral-500 text-xs mb-3">Nombres separados por coma. Aparecerán en el selector del cotizador.</p>
                                    <input
                                        type="text"
                                        value={settings.listas.join(", ")}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            listas: e.target.value
                                                .split(",")
                                                .map((s: string) => s.trim().toLowerCase())
                                                .filter(Boolean)
                                        })}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                                        placeholder="local, valles"
                                    />
                                </div>

                                <hr className="border-neutral-800" />

                                <div>
                                    <label className="block text-sm font-medium text-white mb-1">Recargo por lista</label>
                                    <p className="text-neutral-500 text-xs mb-3">
                                        Porcentaje de aumento sobre los precios base (lista local) para cada lista adicional. Los productos siempre se suben desde un solo PDF.
                                    </p>
                                    <div className="space-y-3">
                                        {settings.listas.filter((l: string) => l.toLowerCase() !== "local").map((lst: string) => {
                                            const listKey = lst.trim().toLowerCase();
                                            const markup = Number(settings.listaMarkups?.[listKey] ?? 0);
                                            return (
                                            <div key={lst} className="flex items-center gap-3">
                                                <span className="text-white text-sm font-bold uppercase w-20">{lst}</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step={0.5}
                                                    value={markup}
                                                    onChange={(e) => setSettings({
                                                        ...settings,
                                                        listaMarkups: { ...settings.listaMarkups, [listKey]: Number(e.target.value) }
                                                    })}
                                                    className="w-24 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                                                />
                                                <span className="text-neutral-400 text-sm">%</span>
                                                <span className="text-neutral-500 text-xs">
                                                    {markup > 0
                                                        ? `+${markup}% sobre precio local`
                                                        : "Sin recargo"}
                                                </span>
                                            </div>
                                        )})}
                                        {settings.listas.filter((l: string) => l.toLowerCase() !== "local").length === 0 && (
                                            <p className="text-neutral-600 text-xs">No hay listas adicionales configuradas.</p>
                                        )}
                                    </div>
                                </div>

                                <hr className="border-neutral-800" />

                                <div>
                                    <label className="block text-sm font-medium text-white mb-4">Reglas de redondeo</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-neutral-500 mb-2">Total a pagar</label>
                                            <select
                                                value={settings.redondeoTotal}
                                                onChange={(e) => setSettings({ ...settings, redondeoTotal: Number(e.target.value) })}
                                                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value={2}>2 decimales — $1.234,56</option>
                                                <option value={0}>Sin decimales — $1.235</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-neutral-500 mb-2">Cuota semanal</label>
                                            <select
                                                value={settings.redondeoCuota}
                                                onChange={(e) => setSettings({ ...settings, redondeoCuota: Number(e.target.value) })}
                                                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value={2}>2 decimales — $123,45</option>
                                                <option value={0}>Sin decimales — $123</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB: REGISTROS ── */}
                    {tab === "registros" && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">Registros de Ventas</h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-neutral-400">{registrations.length} registros</span>
                                    <button
                                        onClick={fetchRegistrations}
                                        disabled={loadingRegistrations}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loadingRegistrations ? "animate-spin" : ""}`} />
                                        Actualizar
                                    </button>
                                </div>
                            </div>

                            {loadingRegistrations ? (
                                <div className="flex items-center justify-center py-12 text-neutral-500">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                    Cargando registros...
                                </div>
                            ) : registrations.length === 0 ? (
                                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
                                    <FileText className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                                    <p className="text-neutral-500 text-sm">No hay registros todavía.</p>
                                    <p className="text-neutral-600 text-xs mt-1">Los registros se guardan desde el cotizador al hacer clic en FICHA.</p>
                                </div>
                            ) : (
                                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-neutral-800">
                                                    <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs">Fecha</th>
                                                    <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs">Vendedor</th>
                                                    <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs">Cliente</th>
                                                    <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs">Zona</th>
                                                    <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs">Productos</th>
                                                    <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs">Plan</th>
                                                    <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {registrations.map(reg => (
                                                    <>
                                                        <tr
                                                            key={reg.id}
                                                            onClick={() => setExpandedRegId(expandedRegId === reg.id ? null : reg.id)}
                                                            className="border-b border-neutral-800/60 hover:bg-neutral-800/40 cursor-pointer transition-colors"
                                                        >
                                                            <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">{formatDate(reg.fecha)}</td>
                                                            <td className="px-4 py-3 text-white font-medium">{reg.vendedor || "—"}</td>
                                                            <td className="px-4 py-3 text-white">{reg.cliente}</td>
                                                            <td className="px-4 py-3 text-neutral-400">{reg.zona || "—"}</td>
                                                            <td className="px-4 py-3 text-neutral-300 max-w-[200px]">
                                                                <span className="truncate block" title={reg.productos}>
                                                                    {reg.productos.length > 40 ? reg.productos.slice(0, 40) + "…" : reg.productos}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-neutral-300 text-xs max-w-[160px]">
                                                                <span className="truncate block" title={reg.planes}>{reg.planes || "—"}</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-emerald-400 font-semibold whitespace-nowrap">
                                                                {reg.total ? `$${reg.total}` : "—"}
                                                            </td>
                                                        </tr>
                                                        {expandedRegId === reg.id && (
                                                            <tr key={`${reg.id}-expanded`} className="bg-neutral-800/30">
                                                                <td colSpan={7} className="px-4 py-4">
                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                                                        {[
                                                                            ["ID", reg.id],
                                                                            ["Fecha", formatDate(reg.fecha)],
                                                                            ["Vendedor", reg.vendedor],
                                                                            ["Cliente", reg.cliente],
                                                                            ["N° Cliente", reg.nroCliente],
                                                                            ["DNI", reg.dni],
                                                                            ["Teléfono", reg.telefono],
                                                                            ["Localidad", reg.localidad],
                                                                            ["Zona", reg.zona],
                                                                            ["Productos", reg.productos],
                                                                            ["Plan", reg.planes],
                                                                            ["Anticipo", reg.anticipo],
                                                                            ["Total", reg.total],
                                                                            ["Cónyuge", reg.conyugue],
                                                                            ["DNI Cónyuge", reg.dniConyugue],
                                                                            ["Tel. Cónyuge", reg.telConyugue],
                                                                            ["Observaciones", reg.observaciones],
                                                                        ].map(([label, value]) => (
                                                                            <div key={label} className="bg-neutral-900 rounded-lg p-2 border border-neutral-700">
                                                                                <p className="text-neutral-500 mb-0.5">{label}</p>
                                                                                <p className="text-neutral-200 font-medium break-words">{value || "—"}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB: CLIENTES ── */}
                    {tab === "clientes" && (
                        <div className="space-y-5">
                            <h2 className="text-xl font-bold text-white">Gestión de Clientes</h2>

                            {/* Upload clientes */}
                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                                <h3 className="font-semibold text-white mb-1">Subir lista de clientes</h3>
                                <p className="text-neutral-500 text-sm mb-4">
                                    Sube el archivo Excel (<span className="text-neutral-300">.xlsx</span>) con el historial de clientes. Se usa para autocompletar el formulario de registro.
                                </p>

                                <label className={`
                                    relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-colors cursor-pointer
                                    ${clientsFile
                                        ? "border-indigo-500/60 bg-indigo-500/5 py-5"
                                        : "border-neutral-700 hover:border-indigo-500/40 hover:bg-neutral-800/40 py-10"
                                    }
                                    ${loadingClientsUpload ? "pointer-events-none opacity-50" : ""}
                                `}>
                                    {clientsFile ? (
                                        <div className="flex items-center gap-3 px-4">
                                            <FileText className="w-8 h-8 text-indigo-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-white font-medium text-sm truncate">{clientsFile.name}</p>
                                                <p className="text-neutral-500 text-xs">{(clientsFile.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setClientsFile(null);
                                                    if (clientsFileRef.current) clientsFileRef.current.value = "";
                                                }}
                                                className="ml-auto p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-center px-4">
                                            <Upload className="w-8 h-8 text-neutral-600" />
                                            <p className="text-sm text-neutral-400">
                                                <span className="text-indigo-400 font-medium">Clic para seleccionar</span> o arrastrá el archivo aquí
                                            </p>
                                            <p className="text-xs text-neutral-600">.xlsx</p>
                                        </div>
                                    )}
                                    <input
                                        ref={clientsFileRef}
                                        type="file"
                                        className="hidden"
                                        accept=".xlsx"
                                        onChange={handleClientsFileSelect}
                                    />
                                </label>

                                {clientsFile && (
                                    <button
                                        onClick={handleClientsUpload}
                                        disabled={loadingClientsUpload}
                                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-colors"
                                    >
                                        {loadingClientsUpload
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                                            : <><Upload className="w-4 h-4" /> Subir y cargar clientes</>
                                        }
                                    </button>
                                )}

                                {allClients.length > 0 && (
                                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400">
                                        <CheckCircle className="w-4 h-4" />
                                        {allClients.length} clientes en memoria
                                    </div>
                                )}
                            </div>

                            {/* Lista completa */}
                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold text-white">Clientes en memoria</h3>
                                        {allClients.length > 0 && (
                                            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                                                {filteredClients.length} / {allClients.length}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={fetchClientsPreview}
                                        disabled={loadingClients}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-xs text-white transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${loadingClients ? "animate-spin" : ""}`} />
                                        Actualizar
                                    </button>
                                </div>

                                {loadingClients ? (
                                    <div className="flex items-center gap-2 text-neutral-500 text-sm py-4">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Cargando...
                                    </div>
                                ) : allClients.length === 0 ? (
                                    <p className="text-neutral-500 text-sm">Sin clientes cargados. Sube el archivo Excel primero.</p>
                                ) : (
                                    <>
                                        <div className="mb-4">
                                            <input
                                                type="text"
                                                value={clientsSearch}
                                                onChange={(e) => { setClientsSearch(e.target.value); setClientsPage(0); }}
                                                placeholder="Buscar por nombre, DNI, localidad o zona..."
                                                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-neutral-500"
                                            />
                                        </div>

                                        {paginatedClients.length === 0 ? (
                                            <p className="text-neutral-500 text-sm py-4 text-center">Sin resultados para esa búsqueda.</p>
                                        ) : (
                                            <div className="overflow-x-auto rounded-xl border border-neutral-800">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-neutral-800/60 border-b border-neutral-700">
                                                            <th className="text-left px-4 py-2.5 text-neutral-400 font-semibold text-xs uppercase tracking-wide">Nombre</th>
                                                            <th className="text-left px-4 py-2.5 text-neutral-400 font-semibold text-xs uppercase tracking-wide">N° Cliente</th>
                                                            <th className="text-left px-4 py-2.5 text-neutral-400 font-semibold text-xs uppercase tracking-wide">Teléfono</th>
                                                            <th className="text-left px-4 py-2.5 text-neutral-400 font-semibold text-xs uppercase tracking-wide">Localidad</th>
                                                            <th className="text-left px-4 py-2.5 text-neutral-400 font-semibold text-xs uppercase tracking-wide">Zona</th>
                                                            <th className="text-left px-4 py-2.5 text-neutral-400 font-semibold text-xs uppercase tracking-wide">Rubro</th>
                                                            <th className="w-8"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedClients.map((c, i) => {
                                                            const isExpanded = expandedClientNombre === c.nombre;
                                                            return (
                                                                <>
                                                                    <tr
                                                                        key={`${i}-row`}
                                                                        onClick={() => setExpandedClientNombre(isExpanded ? null : c.nombre)}
                                                                        className={`border-b border-neutral-800/60 cursor-pointer transition-colors ${isExpanded ? "bg-indigo-500/5 border-indigo-500/20" : "hover:bg-neutral-800/40"}`}
                                                                    >
                                                                        <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{c.nombre}</td>
                                                                        <td className="px-4 py-3 text-indigo-300 text-xs font-mono">{c.nroCliente || "—"}</td>
                                                                        <td className="px-4 py-3 text-neutral-300">{c.telefono || "—"}</td>
                                                                        <td className="px-4 py-3 text-neutral-300">{c.localidad || "—"}</td>
                                                                        <td className="px-4 py-3 text-neutral-400">{c.zona || "—"}</td>
                                                                        <td className="px-4 py-3 text-neutral-400">{c.rubro || "—"}</td>
                                                                        <td className="px-4 py-3">
                                                                            <ChevronRight className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                                                                        </td>
                                                                    </tr>
                                                                    {isExpanded && (
                                                                        <tr key={`${i}-expanded`} className="bg-neutral-900/60 border-b border-neutral-800">
                                                                            <td colSpan={7} className="px-4 py-4">
                                                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                                                    {[
                                                                                        ["Nombre", c.nombre],
                                                                                        ["N° Cliente", c.nroCliente],
                                                                                        ["DNI", c.dni],
                                                                                        ["Teléfono", c.telefono],
                                                                                        ["Localidad", c.localidad],
                                                                                        ["Zona", c.zona],
                                                                                        ["Rubro", c.rubro],
                                                                                        ["Dom. Comercial", c.domCom],
                                                                                        ["Dom. Particular", c.domPar],
                                                                                        ["Cónyuge", c.conyugue],
                                                                                        ["DNI Cónyuge", c.dniConyugue],
                                                                                        ["Tel. Cónyuge", c.telConyugue],
                                                                                    ].map(([label, value]) => (
                                                                                        <div key={label} className="bg-neutral-800 rounded-lg px-3 py-2 border border-neutral-700/60">
                                                                                            <p className="text-neutral-500 text-[10px] uppercase tracking-wide mb-0.5">{label}</p>
                                                                                            <p className="text-neutral-200 text-xs font-medium break-words">{value || "—"}</p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {totalClientPages > 1 && (
                                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
                                                <p className="text-xs text-neutral-500">
                                                    Página {clientsPage + 1} de {totalClientPages} · {filteredClients.length} clientes
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setClientsPage(p => Math.max(0, p - 1))}
                                                        disabled={clientsPage === 0}
                                                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-white text-xs rounded-lg transition-colors"
                                                    >
                                                        ← Anterior
                                                    </button>
                                                    <button
                                                        onClick={() => setClientsPage(p => Math.min(totalClientPages - 1, p + 1))}
                                                        disabled={clientsPage >= totalClientPages - 1}
                                                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-white text-xs rounded-lg transition-colors"
                                                    >
                                                        Siguiente →
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
