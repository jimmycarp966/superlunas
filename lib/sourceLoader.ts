import { Product, CatalogCache } from "./types";
import { supabase } from "./supabase";
import * as xlsx from "xlsx";
import fs from "fs/promises";
import path from "path";

// @ts-ignore
const PDFParser = require("pdf2json");

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "600") * 1000;

declare global {
    var catalogCache: CatalogCache | undefined;
}

const parseExcelBuffer = (buffer: Buffer): Product[] => {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet) as any[];

    return rawRows.map((row) => ({
        codigo: String(row.codigo || row.Codigo || "").trim(),
        nombre: String(row.nombre || row.Nombre || row.descripcion || "").trim(),
        precio: normalizePrice(String(row.precio || row.Precio || "0")),
        stock: Number(row.stock || row.Stock || 100),
        lista: String(row.lista || row.Lista || "local").trim().toLowerCase(),
    })).filter(p => p.codigo !== "");
};

const parsePdfBuffer = async (buffer: Buffer): Promise<Product[]> => {
    return new Promise((resolve) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", () => resolve([]));

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const products: Product[] = [];

            let headerCols: { codigo: number; nombre: number; precio: number; stock: number | null } | null = null;

            for (const page of pdfData.Pages || []) {
                const texts = page.Texts || [];

                const linesMap = new Map<number, { x: number; text: string }[]>();

                for (const t of texts) {
                    const y = Math.round(t.y * 10) / 10;
                    const txt = decodeURIComponent(t.R[0].T).trim();
                    if (!txt) continue;
                    if (!linesMap.has(y)) linesMap.set(y, []);
                    linesMap.get(y)!.push({ x: t.x, text: txt });
                }

                const yKeys = Array.from(linesMap.keys()).sort((a, b) => a - b);

                for (const y of yKeys) {
                    const items = linesMap.get(y)!.sort((a, b) => a.x - b.x);
                    if (items.length < 2) continue;

                    if (!headerCols) {
                        const lowered = items.map(i => i.text.toLowerCase());
                        const hasCodigo = lowered.some(t => t.includes("cod"));
                        const hasNombre = lowered.some(t => t.includes("nombre") || t.includes("descripci"));
                        const hasPrecio = lowered.some(t => t.includes("precio") || t.includes("importe"));

                        if (hasCodigo && hasNombre && hasPrecio) {
                            const cItem = items.find(i => i.text.toLowerCase().includes("cod"));
                            const nItem = items.find(i => {
                                const t = i.text.toLowerCase();
                                return t.includes("nombre") || t.includes("descripci");
                            });
                            const pItem = items.find(i => {
                                const t = i.text.toLowerCase();
                                return t.includes("precio") || t.includes("importe");
                            });
                            const sItem = items.find(i => i.text.toLowerCase().includes("stock"));

                            if (cItem && nItem && pItem) {
                                headerCols = {
                                    codigo: cItem.x,
                                    nombre: nItem.x,
                                    precio: pItem.x,
                                    stock: sItem ? sItem.x : null,
                                };
                            }
                            continue;
                        }
                    }

                    if (items.length < 3) continue;

                    if (headerCols) {
                        const codigoItems: string[] = [];
                        const nombreItems: string[] = [];
                        const precioItems: string[] = [];
                        const stockItems: string[] = [];

                        for (const item of items) {
                            const candidates: { col: string; d: number }[] = [
                                { col: "codigo", d: Math.abs(item.x - headerCols.codigo) },
                                { col: "nombre", d: Math.abs(item.x - headerCols.nombre) },
                                { col: "precio", d: Math.abs(item.x - headerCols.precio) },
                            ];
                            if (headerCols.stock !== null) {
                                candidates.push({ col: "stock", d: Math.abs(item.x - headerCols.stock) });
                            }
                            const nearest = candidates.reduce((a, b) => a.d < b.d ? a : b);
                            if (nearest.col === "codigo") codigoItems.push(item.text);
                            else if (nearest.col === "nombre") nombreItems.push(item.text);
                            else if (nearest.col === "precio") precioItems.push(item.text);
                            else stockItems.push(item.text);
                        }

                        const codigo = codigoItems.join("").trim();
                        const nombre = nombreItems.join(" ").trim();
                        const rawPrecio = precioItems.find(p => /\d/.test(p)) || "0";
                        const stockRaw = stockItems.length > 0 ? parseInt(stockItems[0]) : NaN;
                        const stock = !isNaN(stockRaw) && stockRaw >= 0 ? stockRaw : 100;

                        if (codigo && /^[a-zA-Z0-9-]{2,}$/.test(codigo) && nombre) {
                            products.push({
                                codigo,
                                nombre,
                                precio: normalizePrice(rawPrecio),
                                stock,
                                lista: "local",
                            });
                        }
                    } else {
                        const codigo = items[0].text;

                        const codigoL = codigo.toLowerCase();
                        if (codigoL.includes("cod") || codigoL.includes("lista") || codigoL.includes("total")) continue;

                        let rawPrecio = "0";
                        let precioIdx = -1;
                        for (let i = items.length - 1; i >= 2; i--) {
                            const clean = items[i].text.replace(/[^\d.,]/g, "");
                            if (clean.length >= 2 && /^\d/.test(clean)) {
                                rawPrecio = items[i].text;
                                precioIdx = i;
                                break;
                            }
                        }

                        let stock = 100;
                        for (let i = precioIdx + 1; i < items.length; i++) {
                            const n = parseInt(items[i].text);
                            if (!isNaN(n) && n >= 0 && n <= 9999) {
                                stock = n;
                                break;
                            }
                        }

                        const endNombre = precioIdx > 0 ? precioIdx : items.length - 1;
                        const nombre = items.slice(1, endNombre).map(i => i.text).join(" ").trim();

                        if (/^[a-zA-Z0-9-]{3,}$/.test(codigo) && nombre) {
                            products.push({
                                codigo,
                                nombre,
                                precio: normalizePrice(rawPrecio),
                                stock,
                                lista: "local",
                            });
                        }
                    }
                }
            }

            resolve(products);
        });

        pdfParser.parseBuffer(buffer);
    });
};

const normalizePrice = (rawVal: string): number => {
    let clean = rawVal.replace(/[^\d.,]/g, "");

    if (clean.length > 3 && clean[clean.length - 3] === ',') {
        clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.length > 3 && clean[clean.length - 3] === '.') {
        clean = clean.replace(/,/g, "");
    } else {
        clean = clean.replace(/[.,]/g, "");
    }

    return parseFloat(clean) || 0;
};

const loadProductsFromSupabase = async (): Promise<Product[] | null> => {
    try {
        const { data, error } = await supabase
            .from("products")
            .select("*");

        if (error || !data || data.length === 0) return null;

        return (data as Record<string, unknown>[]).map(row => ({
            codigo: String(row.codigo),
            nombre: String(row.nombre),
            precio: Number(row.precio),
            stock: Number(row.stock),
            lista: String(row.lista),
        }));
    } catch {
        return null;
    }
};

const saveProductsToSupabase = async (products: Product[]): Promise<void> => {
    try {
        await supabase.from("products").delete().neq("codigo", "");
        if (products.length > 0) {
            const rows = products.map(p => ({
                codigo: p.codigo,
                nombre: p.nombre,
                precio: p.precio,
                stock: p.stock,
                lista: p.lista,
            }));
            // Insertar en lotes de 500 para evitar límites
            const BATCH = 500;
            for (let i = 0; i < rows.length; i += BATCH) {
                await supabase.from("products").insert(rows.slice(i, i + BATCH));
            }
        }
    } catch (err) {
        console.error("Error guardando productos en Supabase:", err);
    }
};

export const fetchSourceFile = async (forceRefresh = false): Promise<Product[]> => {
    const now = Date.now();

    if (!forceRefresh && global.catalogCache) {
        if (now - global.catalogCache.updatedAt < CACHE_TTL) {
            return global.catalogCache.data;
        }
    }

    // Cold start: intentar cargar desde Supabase sin re-parsear el archivo
    if (!forceRefresh) {
        const fromDb = await loadProductsFromSupabase();
        if (fromDb && fromDb.length > 0) {
            global.catalogCache = {
                data: fromDb,
                updatedAt: now,
                sourceVersion: `db-${now}-${fromDb.length}`,
            };
            return fromDb;
        }
    }

    try {
        const defaultLocalUrl = path.join(process.cwd(), "..", "LISTA DE PRECIO LOCAL TACO RALO CATAMARCA.pdf");
        const sourceUrl = process.env.SOURCE_FILE_URL || defaultLocalUrl;
        let fileBuffer: Buffer;
        const isPdf = process.env.SOURCE_FILE_TYPE === 'pdf' || defaultLocalUrl.toLowerCase().endsWith('.pdf');

        if (sourceUrl.startsWith('http')) {
            const opts: RequestInit = {};
            if (process.env.SOURCE_AUTH_TOKEN) {
                opts.headers = { Authorization: `Bearer ${process.env.SOURCE_AUTH_TOKEN}` };
            }
            const response = await fetch(sourceUrl, opts);
            if (!response.ok) throw new Error("Fallo descarga remota");
            fileBuffer = Buffer.from(await response.arrayBuffer());
        } else {
            fileBuffer = await fs.readFile(sourceUrl);
        }

        let rawProducts: Product[] = [];
        if (isPdf) {
            rawProducts = await parsePdfBuffer(fileBuffer);
        } else {
            rawProducts = parseExcelBuffer(fileBuffer);
        }

        const deduplicated = Array.from(new Map(
            rawProducts.map(p => [`${p.codigo}-${p.lista}`, p])
        ).values());

        await saveProductsToSupabase(deduplicated);

        global.catalogCache = {
            data: deduplicated,
            updatedAt: now,
            sourceVersion: `${now}-${deduplicated.length}`,
        };

        return deduplicated;
    } catch (error) {
        console.error("Error cargando fuente:", error);
        if (global.catalogCache) {
            console.warn("Retornando catalogo anterior estandar");
            return global.catalogCache.data;
        }
        throw error;
    }
};

export const getCurrentCatalog = async (opts?: { forceRefresh?: boolean }): Promise<Product[]> => {
    return await fetchSourceFile(opts?.forceRefresh);
};

export const loadFromBuffer = async (buffer: Buffer, type: "pdf" | "excel"): Promise<number> => {
    const now = Date.now();
    let products: Product[];

    if (type === "pdf") {
        products = await parsePdfBuffer(buffer);
    } else {
        products = parseExcelBuffer(buffer);
    }

    const deduplicated = Array.from(new Map(
        products.map(p => [`${p.codigo}-${p.lista}`, p])
    ).values());

    await saveProductsToSupabase(deduplicated);

    global.catalogCache = {
        data: deduplicated,
        updatedAt: now,
        sourceVersion: `${now}-${deduplicated.length}`,
    };

    return deduplicated.length;
};
