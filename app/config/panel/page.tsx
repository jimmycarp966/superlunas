"use client";

import { useState, useEffect } from "react";
import { Settings, RefreshCw, Upload, LogOut, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminPanel() {
    const [tab, setTab] = useState<"origen" | "planes" | "ajustes">("origen");
    const [sourceStatus, setSourceStatus] = useState<any>(null);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [loadingUpload, setLoadingUpload] = useState(false);
    const router = useRouter();

    // Settings
    const [settings, setSettings] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);

    useEffect(() => {
        fetchStatus();
        fetchSettings();
        fetchPlans();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch("/api/source/refresh");
            const data = await res.json();
            if (data.success) setSourceStatus(data);
        } catch (e) { }
    };

    const fetchSettings = async () => {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (json.success) setSettings(json.data);
    };

    const fetchPlans = async () => {
        const res = await fetch("/api/plans");
        const json = await res.json();
        if (json.success) setPlans(json.data);
    };

    const handleRefreshSource = async () => {
        setLoadingConfig(true);
        try {
            await fetch("/api/source/refresh", { method: "POST" });
            await fetchStatus();
        } finally {
            setLoadingConfig(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];

        const formData = new FormData();
        formData.append("file", file);

        setLoadingUpload(true);
        try {
            const res = await fetch("/api/source/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                alert("Archivo cargado y procesado. Catalogo actualizado a " + data.itemsCount + " items.");
                await fetchStatus();
            } else {
                alert("Error: " + data.error);
            }
        } catch (err: any) {
            alert("Error subiendo: " + err.message);
        } finally {
            setLoadingUpload(false);
        }
    };

    const handleSaveSettings = async () => {
        const res = await fetch("/api/settings", {
            method: "PUT",
            body: JSON.stringify(settings),
        });
        if (res.ok) alert("Ajustes guardados");
    };

    const handleSavePlans = async () => {
        const res = await fetch("/api/plans", {
            method: "PUT",
            body: JSON.stringify(plans),
        });
        if (res.ok) alert("Planes guardados");
    };

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/config");
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-neutral-200">
            <header className="bg-neutral-800 border-b border-neutral-700 sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                        <Settings className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Panel de Administración</h1>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                >
                    <LogOut className="w-4 h-4" /> Salir
                </button>
            </header>

            <main className="max-w-5xl mx-auto p-6 md:p-8 flex flex-col md:flex-row gap-8">
                {/* Sidebar Nav */}
                <nav className="w-full md:w-64 flex flex-col gap-2 flex-shrink-0">
                    {[
                        { id: "origen", label: "Origen de Datos" },
                        { id: "planes", label: "Planes de Financiación" },
                        { id: "ajustes", label: "Ajustes Globales" },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setTab(item.id as any)}
                            className={`text-left px-4 py-3 rounded-xl transition-all font-medium ${tab === item.id
                                    ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/30"
                                    : "hover:bg-neutral-800 text-neutral-400"
                                }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Content Area */}
                <div className="flex-1 min-w-0">

                    {tab === "origen" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h2 className="text-2xl font-semibold text-white">Catálogo de Productos</h2>

                            {/* Status Card */}
                            <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-1">
                                            {sourceStatus?.status === 'ready' ? (
                                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                            ) : (
                                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                            )}
                                            Estado Actual
                                        </h3>
                                        <p className="text-neutral-400 text-sm">Información de la memoria en runtime</p>
                                    </div>
                                    <button
                                        onClick={handleRefreshSource}
                                        disabled={loadingConfig}
                                        className="flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loadingConfig ? "animate-spin" : ""}`} />
                                        Forzar Recarga
                                    </button>
                                </div>

                                {sourceStatus && (
                                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                                            <div className="text-neutral-500 text-sm font-medium mb-1">Productos</div>
                                            <div className="text-2xl font-bold text-white">{sourceStatus.itemsCount || 0}</div>
                                        </div>
                                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                                            <div className="text-neutral-500 text-sm font-medium mb-1">Última Carga</div>
                                            <div className="text-lg font-bold text-white">
                                                {sourceStatus.updatedAt ? new Date(sourceStatus.updatedAt).toLocaleTimeString() : 'N/A'}
                                            </div>
                                        </div>
                                        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 col-span-2">
                                            <div className="text-neutral-500 text-sm font-medium mb-1">Versión / Hash</div>
                                            <div className="text-sm font-mono text-neutral-300 truncate">
                                                {sourceStatus.sourceVersion || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Upload Card */}
                            <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-6">
                                <h3 className="text-lg font-medium text-white mb-2">Reemplazar Archivo Local</h3>
                                <p className="text-neutral-400 text-sm mb-6">
                                    Sube un archivo Excel (.xlsx) o PDF (.pdf). Esto parseará inmediatamente y actualizará la caché en memoria y sobreescribirá la fuente de verdad del entorno local.
                                </p>

                                <label className={`
                  relative flex flex-col items-center justify-center w-full h-48 
                  border-2 border-dashed border-neutral-600 rounded-xl
                  hover:bg-neutral-700/50 hover:border-indigo-500/50 transition-colors
                  cursor-pointer group
                  ${loadingUpload ? 'pointer-events-none opacity-50' : ''}
                `}>
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-10 h-10 text-neutral-500 group-hover:text-indigo-400 mb-3 transition-colors" />
                                        <p className="mb-2 text-sm text-neutral-400">
                                            <span className="font-semibold text-white">Haz clic para subir</span> o arrastra y suelta
                                        </p>
                                        <p className="text-xs text-neutral-500">Sólo archivos .pdf o .xlsx</p>
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.xlsx"
                                        onChange={handleFileUpload}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {tab === "planes" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-semibold text-white">Planes de Financiación</h2>
                                <button
                                    onClick={handleSavePlans}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Guardar Planes
                                </button>
                            </div>

                            <div className="bg-neutral-800 border border-neutral-700 rounded-2xl overflow-hidden">
                                <div className="p-4 bg-neutral-800 border-b border-neutral-700 grid grid-cols-12 gap-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                                    <div className="col-span-1 text-center">Ord</div>
                                    <div className="col-span-3">Nombre</div>
                                    <div className="col-span-2 text-center">Semanas</div>
                                    <div className="col-span-2 text-center">Tasa %</div>
                                    <div className="col-span-2">Badge</div>
                                    <div className="col-span-2 text-center">Estado</div>
                                </div>

                                <div className="divide-y divide-neutral-700">
                                    {plans.map((plan, i) => (
                                        <div key={plan.id} className="p-4 grid grid-cols-12 gap-4 items-center bg-neutral-800">
                                            <div className="col-span-1">
                                                <input
                                                    type="number"
                                                    value={plan.orden}
                                                    onChange={(e) => {
                                                        const p = [...plans]; p[i].orden = Number(e.target.value); setPlans(p);
                                                    }}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-center"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input
                                                    type="text"
                                                    value={plan.nombre}
                                                    onChange={(e) => {
                                                        const p = [...plans]; p[i].nombre = e.target.value; setPlans(p);
                                                    }}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1 text-sm"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    value={plan.semanas}
                                                    onChange={(e) => {
                                                        const p = [...plans]; p[i].semanas = Number(e.target.value); setPlans(p);
                                                    }}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-center"
                                                />
                                            </div>
                                            <div className="col-span-2 relative">
                                                <input
                                                    type="number"
                                                    value={plan.tasaPorcentaje}
                                                    onChange={(e) => {
                                                        const p = [...plans]; p[i].tasaPorcentaje = Number(e.target.value); setPlans(p);
                                                    }}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-center pr-6"
                                                />
                                                <span className="absolute right-3 top-1.5 text-neutral-500 text-sm">%</span>
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    value={plan.badge || ""}
                                                    placeholder="Ej: Promoción"
                                                    onChange={(e) => {
                                                        const p = [...plans]; p[i].badge = e.target.value; setPlans(p);
                                                    }}
                                                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm placeholder-neutral-600"
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-center">
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={plan.activo}
                                                        onChange={(e) => {
                                                            const p = [...plans]; p[i].activo = e.target.checked; setPlans(p);
                                                        }}
                                                    />
                                                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-neutral-800 border-t border-neutral-700">
                                    <button
                                        onClick={() => {
                                            setPlans([...plans, { id: Date.now().toString(), nombre: "Nuevo Plan", semanas: 10, tasaPorcentaje: 0, activo: true, orden: plans.length + 1 }]);
                                        }}
                                        className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                                    >
                                        + Agregar otro plan
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "ajustes" && settings && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-semibold text-white">Ajustes Generales</h2>
                                <button
                                    onClick={handleSaveSettings}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Guardar Ajustes
                                </button>
                            </div>

                            <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-6 space-y-8">
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-4">Configuración de Listas</h3>
                                    <div className="space-y-3">
                                        <label className="block text-sm font-medium text-neutral-400">Listas Disponibles (separadas por coma)</label>
                                        <input
                                            type="text"
                                            value={settings.listas.join(", ")}
                                            onChange={(e) => setSettings({ ...settings, listas: e.target.value.split(",").map(s => s.trim()) })}
                                            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
                                        />
                                        <p className="text-xs text-neutral-500">Estas listas aparecerán en el selector principal del vendedor.</p>
                                    </div>
                                </div>

                                <hr className="border-neutral-700" />

                                <div>
                                    <h3 className="text-lg font-medium text-white mb-4">Reglas de Redondeo</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-neutral-400">Total a Pagar (Decimales)</label>
                                            <select
                                                value={settings.redondeoTotal}
                                                onChange={(e) => setSettings({ ...settings, redondeoTotal: Number(e.target.value) })}
                                                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
                                            >
                                                <option value={2}>2 Decimales (ej. $1,234.56)</option>
                                                <option value={0}>0 Decimales (ej. $1,235)</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-neutral-400">Cuota Semanal (Decimales)</label>
                                            <select
                                                value={settings.redondeoCuota}
                                                onChange={(e) => setSettings({ ...settings, redondeoCuota: Number(e.target.value) })}
                                                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none"
                                            >
                                                <option value={2}>2 Decimales (ej. $123.45)</option>
                                                <option value={0}>0 Decimales (ej. $123)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
