"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ImagePlus, Plus, Trash2 } from "lucide-react";

interface ProductItem {
    codigo: string;
    nombre: string;
    precio: number;
    stock: number;
    color?: string | null;
    tamano?: string | null;
    modelo?: string | null;
    garantia_meses?: number | null;
    requiere_serie?: boolean;
    numero_serie?: string | null;
    imagen_url?: string | null;
}

interface ProductVariant {
    id: string;
    color: string;
    tamano: string;
    modelo: string;
    precio?: number | null;
    stock?: number | null;
}

interface ProductPhoto {
    id: string;
    url: string;
    is_primary: boolean;
    orden: number;
}

export default function AlmacenProductosPage() {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [search, setSearch] = useState("");
    const [selectedCodigo, setSelectedCodigo] = useState("");
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [requiresSerie, setRequiresSerie] = useState(false);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [photos, setPhotos] = useState<ProductPhoto[]>([]);
    const [newPhotoUrl, setNewPhotoUrl] = useState("");
    const [newVariant, setNewVariant] = useState({
        color: "",
        tamano: "",
        modelo: "",
        precio: "",
        stock: "",
    });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const selectedProduct = useMemo(
        () => products.find((item) => item.codigo === selectedCodigo) ?? null,
        [products, selectedCodigo],
    );

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return products.slice(0, 150);
        return products
            .filter(
                (item) =>
                    item.codigo.toLowerCase().includes(q) || item.nombre.toLowerCase().includes(q),
            )
            .slice(0, 150);
    }, [products, search]);

    const fillDraftFromProduct = (product: ProductItem) => {
        setDraft({
            color: String(product.color ?? ""),
            tamano: String(product.tamano ?? ""),
            modelo: String(product.modelo ?? ""),
            garantiaMeses: String(product.garantia_meses ?? ""),
            numeroSerie: String(product.numero_serie ?? ""),
            imagenUrl: String(product.imagen_url ?? ""),
        });
        setRequiresSerie(Boolean(product.requiere_serie));
    };

    const fetchProducts = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/products?list=local", { cache: "no-store" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setError(json.error || "No se pudo cargar productos.");
                return;
            }
            const loaded: ProductItem[] = Array.isArray(json.data) ? json.data : [];
            setProducts(loaded);

            if (!selectedCodigo && loaded[0]) {
                setSelectedCodigo(loaded[0].codigo);
                fillDraftFromProduct(loaded[0]);
            } else if (selectedCodigo) {
                const current = loaded.find((item) => item.codigo === selectedCodigo);
                if (current) fillDraftFromProduct(current);
            }
        } catch {
            setError("Error de red al cargar productos.");
        } finally {
            setLoading(false);
        }
    };

    const fetchSecondaryData = async (codigo: string) => {
        try {
            const [variantsRes, photosRes] = await Promise.all([
                fetch(`/api/products/${codigo}/variants`, { cache: "no-store" }),
                fetch(`/api/products/${codigo}/photos`, { cache: "no-store" }),
            ]);
            const variantsJson = await variantsRes.json();
            const photosJson = await photosRes.json();
            setVariants(Array.isArray(variantsJson.data) ? variantsJson.data : []);
            setPhotos(Array.isArray(photosJson.data) ? photosJson.data : []);
        } catch {
            setVariants([]);
            setPhotos([]);
        }
    };

    useEffect(() => {
        void fetchProducts();
    }, []);

    useEffect(() => {
        if (!selectedCodigo) return;
        const product = products.find((item) => item.codigo === selectedCodigo);
        if (product) fillDraftFromProduct(product);
        void fetchSecondaryData(selectedCodigo);
    }, [selectedCodigo, products]);

    const saveProduct = async () => {
        if (!selectedProduct) return;
        setMessage("");
        setError("");
        try {
            const res = await fetch("/api/products", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    codigo: selectedProduct.codigo,
                    color: draft.color,
                    tamano: draft.tamano,
                    modelo: draft.modelo,
                    garantiaMeses: draft.garantiaMeses ? Number(draft.garantiaMeses) : null,
                    requiereSerie: requiresSerie,
                    numeroSerie: draft.numeroSerie,
                    imagenUrl: draft.imagenUrl,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setError(json.error || "No se pudo guardar producto.");
                return;
            }
            setMessage("Producto actualizado.");
            await fetchProducts();
        } catch {
            setError("Error de red al guardar producto.");
        }
    };

    const addPhoto = async () => {
        if (!selectedCodigo || !newPhotoUrl.trim()) return;
        const res = await fetch(`/api/products/${selectedCodigo}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: newPhotoUrl.trim(),
                isPrimary: photos.length === 0,
                orden: photos.length + 1,
            }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            setError(json.error || "No se pudo agregar la foto.");
            return;
        }
        setNewPhotoUrl("");
        await fetchSecondaryData(selectedCodigo);
        await fetchProducts();
    };

    const deletePhoto = async (photoId: string) => {
        if (!selectedCodigo) return;
        const res = await fetch(`/api/products/${selectedCodigo}/photos`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            setError(json.error || "No se pudo borrar la foto.");
            return;
        }
        await fetchSecondaryData(selectedCodigo);
    };

    const addVariant = async () => {
        if (!selectedCodigo) return;
        const res = await fetch(`/api/products/${selectedCodigo}/variants`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                color: newVariant.color,
                tamano: newVariant.tamano,
                modelo: newVariant.modelo,
                precio: newVariant.precio ? Number(newVariant.precio) : null,
                stock: newVariant.stock ? Number(newVariant.stock) : null,
            }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            setError(json.error || "No se pudo agregar la variante.");
            return;
        }
        setNewVariant({ color: "", tamano: "", modelo: "", precio: "", stock: "" });
        await fetchSecondaryData(selectedCodigo);
    };

    const deleteVariant = async (variantId: string) => {
        if (!selectedCodigo) return;
        const res = await fetch(`/api/products/${selectedCodigo}/variants`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variantId }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            setError(json.error || "No se pudo borrar la variante.");
            return;
        }
        await fetchSecondaryData(selectedCodigo);
    };

    const copyPhoto = async (url: string) => {
        await navigator.clipboard.writeText(url);
        setMessage("URL de foto copiada para cotizador.");
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0a1220] text-slate-200 p-6">
                Cargando productos...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#0a1220] text-slate-200 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-4">
                <header className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="text-2xl font-black text-white">Almacen y Catalogo</h1>
                        <p className="text-sm text-slate-400">
                            Variantes, garantia/serie y fotos multiples para cotizador.
                        </p>
                    </div>
                    <a
                        href="/cotizador"
                        className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm font-semibold"
                    >
                        Volver
                    </a>
                </header>

                {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {error}
                    </div>
                )}
                {message && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                        {message}
                    </div>
                )}

                <section className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
                    <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                        <input
                            type="text"
                            placeholder="Buscar codigo o nombre..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                        />
                        <div className="mt-3 max-h-[70vh] overflow-y-auto space-y-1">
                            {filtered.map((item) => (
                                <button
                                    key={item.codigo}
                                    onClick={() => setSelectedCodigo(item.codigo)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${
                                        selectedCodigo === item.codigo
                                            ? "bg-sky-500/15 border-sky-500/30 text-sky-100"
                                            : "bg-slate-950 border-slate-800 text-slate-300"
                                    }`}
                                >
                                    <p className="font-semibold">{item.codigo}</p>
                                    <p className="text-xs text-slate-400 truncate">{item.nombre}</p>
                                </button>
                            ))}
                        </div>
                    </aside>

                    <div className="space-y-4">
                        {selectedProduct && (
                            <>
                                <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                                    <h2 className="text-lg font-black text-white">
                                        {selectedProduct.codigo} - {selectedProduct.nombre}
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        <input
                                            type="text"
                                            placeholder="Color"
                                            value={draft.color ?? ""}
                                            onChange={(e) =>
                                                setDraft((prev) => ({ ...prev, color: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Tamano/Talle"
                                            value={draft.tamano ?? ""}
                                            onChange={(e) =>
                                                setDraft((prev) => ({ ...prev, tamano: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Modelo"
                                            value={draft.modelo ?? ""}
                                            onChange={(e) =>
                                                setDraft((prev) => ({ ...prev, modelo: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Garantia (meses)"
                                            value={draft.garantiaMeses ?? ""}
                                            onChange={(e) =>
                                                setDraft((prev) => ({ ...prev, garantiaMeses: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={requiresSerie}
                                                onChange={(e) => setRequiresSerie(e.target.checked)}
                                                className="accent-emerald-500"
                                            />
                                            Requiere numero de serie
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Numero de serie"
                                            value={draft.numeroSerie ?? ""}
                                            onChange={(e) =>
                                                setDraft((prev) => ({ ...prev, numeroSerie: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <input
                                            type="text"
                                            placeholder="URL imagen principal"
                                            value={draft.imagenUrl ?? ""}
                                            onChange={(e) =>
                                                setDraft((prev) => ({ ...prev, imagenUrl: e.target.value }))
                                            }
                                            className="sm:col-span-2 lg:col-span-3 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                    </div>
                                    <button
                                        onClick={saveProduct}
                                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                                    >
                                        Guardar datos del producto
                                    </button>
                                </section>

                                <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-base font-black text-white">Fotos multiples</h3>
                                        {selectedProduct.imagen_url && (
                                            <button
                                                onClick={() => copyPhoto(selectedProduct.imagen_url as string)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                Copiar foto al cotizador
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <input
                                            type="text"
                                            placeholder="https://..."
                                            value={newPhotoUrl}
                                            onChange={(e) => setNewPhotoUrl(e.target.value)}
                                            className="flex-1 min-w-[220px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <button
                                            onClick={addPhoto}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
                                        >
                                            <ImagePlus className="w-4 h-4" />
                                            Agregar foto
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {photos.map((photo) => (
                                            <div
                                                key={photo.id}
                                                className="rounded-lg border border-slate-800 bg-slate-950 p-2 flex items-center gap-2"
                                            >
                                                <img
                                                    src={photo.url}
                                                    alt="Foto producto"
                                                    className="w-16 h-16 object-cover rounded-md border border-slate-700"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-slate-300 truncate">{photo.url}</p>
                                                    {photo.is_primary && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">
                                                            Principal
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => deletePhoto(photo.id)}
                                                    className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
                                    <h3 className="text-base font-black text-white">Variantes</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Color"
                                            value={newVariant.color}
                                            onChange={(e) =>
                                                setNewVariant((prev) => ({ ...prev, color: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Tamano"
                                            value={newVariant.tamano}
                                            onChange={(e) =>
                                                setNewVariant((prev) => ({ ...prev, tamano: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Modelo"
                                            value={newVariant.modelo}
                                            onChange={(e) =>
                                                setNewVariant((prev) => ({ ...prev, modelo: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Precio"
                                            value={newVariant.precio}
                                            onChange={(e) =>
                                                setNewVariant((prev) => ({ ...prev, precio: e.target.value }))
                                            }
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                placeholder="Stock"
                                                value={newVariant.stock}
                                                onChange={(e) =>
                                                    setNewVariant((prev) => ({ ...prev, stock: e.target.value }))
                                                }
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                            />
                                            <button
                                                onClick={addVariant}
                                                className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {variants.map((variant) => (
                                            <div
                                                key={variant.id}
                                                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 flex items-center justify-between"
                                            >
                                                <p className="text-sm text-slate-200">
                                                    {variant.color || "-"} / {variant.tamano || "-"} /{" "}
                                                    {variant.modelo || "-"} - ${" "}
                                                    {variant.precio ? Number(variant.precio).toLocaleString("es-AR") : "-"}
                                                </p>
                                                <button
                                                    onClick={() => deleteVariant(variant.id)}
                                                    className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

