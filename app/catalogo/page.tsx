"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Search, Share2 } from "lucide-react";

interface CatalogProduct {
    codigo: string;
    nombre: string;
    precio: number;
    stock: number;
    imagenUrl?: string | null;
}

const formatARS = (value: number): string => {
    return Math.round(value || 0).toLocaleString("es-AR");
};

export default function CatalogoPage() {
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/products?list=local", { cache: "no-store" });
                const json = await res.json();
                if (res.ok && json.success) {
                    setProducts(Array.isArray(json.data) ? json.data : []);
                }
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return products;
        return products.filter(
            (item) =>
                item.codigo.toLowerCase().includes(q) || item.nombre.toLowerCase().includes(q),
        );
    }, [products, search]);

    const handleCopy = async (item: CatalogProduct) => {
        const text = `[${item.codigo}] ${item.nombre} - $ ${formatARS(item.precio)}`;
        await navigator.clipboard.writeText(text);
        setMessage("Texto copiado.");
        setTimeout(() => setMessage(""), 1500);
    };

    const handleWhatsapp = (item: CatalogProduct) => {
        const lines = [
            "Consulta de producto - Lunas Confort",
            `[${item.codigo}] ${item.nombre}`,
            `Precio: $ ${formatARS(item.precio)}`,
        ];
        if (item.imagenUrl) lines.push(`Foto: ${item.imagenUrl}`);
        const url = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
        window.open(url, "_blank");
    };

    return (
        <main className="min-h-screen bg-[#f8f8f6] text-[#1f2937] px-3 sm:px-6 py-6">
            <div className="max-w-6xl mx-auto space-y-5">
                <header className="text-center space-y-1">
                    <h1 className="text-3xl font-black text-[#db1818] uppercase tracking-wide">
                        Lunas Confort
                    </h1>
                    <p className="text-sm text-slate-600">Catalogo publico de productos</p>
                </header>

                <section className="rounded-xl bg-white border border-slate-200 p-3">
                    <label className="relative block">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por codigo o nombre..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#db1818]/30"
                        />
                    </label>
                </section>

                {message && (
                    <p className="text-center text-sm text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-lg py-2">
                        {message}
                    </p>
                )}

                {loading ? (
                    <div className="rounded-xl bg-white border border-slate-200 p-6 text-center text-slate-500">
                        Cargando catalogo...
                    </div>
                ) : (
                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filtered.map((item) => (
                            <article
                                key={item.codigo}
                                className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm"
                            >
                                {item.imagenUrl ? (
                                    <img
                                        src={item.imagenUrl}
                                        alt={item.nombre}
                                        className="w-full h-48 object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-48 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                                        Sin foto
                                    </div>
                                )}
                                <div className="p-3 space-y-2">
                                    <p className="text-xs font-semibold text-slate-500">[{item.codigo}]</p>
                                    <h2 className="text-sm font-bold text-slate-800 min-h-10">{item.nombre}</h2>
                                    <p className="text-xl font-black text-[#db1818]">$ {formatARS(item.precio)}</p>
                                    <p className="text-xs text-slate-500">Stock: {item.stock}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleCopy(item)}
                                            className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-50"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Copiar
                                        </button>
                                        <button
                                            onClick={() => handleWhatsapp(item)}
                                            className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#25D366] hover:bg-[#1fb95a] text-white text-xs font-bold"
                                        >
                                            <Share2 className="w-3.5 h-3.5" />
                                            WhatsApp
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </div>
        </main>
    );
}

