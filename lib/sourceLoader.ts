import { Product } from "./types";
import { supabase } from "./supabase";
import * as xlsx from "xlsx";
import fs from "fs/promises";
import path from "path";

// @ts-ignore
const PDFParser = require("pdf2json");

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
};

type PdfLineItem = { x: number; text: string };

const extractNumericToken = (text: string): string | null => {
    const match = text.match(/-?\d[\d.,]*/);
    return match ? match[0] : null;
};

const parseStockToken = (text: string): number | null => {
    const trimmed = text.trim();
    if (!/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) return null;

    const sign = trimmed.startsWith("-") ? -1 : 1;
    const digits = trimmed.replace(/[^\d]/g, "");
    if (!digits) return null;

    const val = sign * parseInt(digits, 10);
    if (!Number.isFinite(val) || Math.abs(val) > 9999) return null;
    return val;
};

const pickBestPriceCandidate = (
    items: PdfLineItem[],
    fromIdx: number,
    toExclusive: number,
): { index: number; text: string } | null => {
    const candidates: { index: number; text: string; value: number; score: number; negative: boolean }[] = [];

    for (let i = fromIdx; i < toExclusive; i++) {
        const text = items[i].text;
        const token = extractNumericToken(text);
        if (!token) continue;

        const value = normalizePrice(token);
        if (!Number.isFinite(value)) continue;

        const digitsCount = token.replace(/[^\d]/g, "").length;
        const negative = token.trim().startsWith("-");
        let score = 0;

        if (/\$/.test(text)) score += 2;
        if (/[.,]/.test(token)) score += 1;
        if (digitsCount >= 4) score += 3;
        if (value >= 1000) score += 4;
        if (value >= 100000) score += 2;
        if (negative) score -= 10;

        // En empates, prioriza valores hacia la derecha de la fila.
        score += i / 1000;

        candidates.push({ index: i, text, value, score, negative });
    }

    if (candidates.length === 0) return null;

    const nonNegative = candidates.filter(c => !c.negative);
    const pool = nonNegative.length > 0 ? nonNegative : candidates;
    pool.sort((a, b) => b.score - a.score || b.value - a.value || b.index - a.index);
    return { index: pool[0].index, text: pool[0].text };
};

const parseExcelBuffer = (buffer: Buffer): Product[] => {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet) as any[];

    return rawRows.map((row) => ({
        codigo: String(row.codigo || row.Codigo || "").trim(),
        nombre: String(row.nombre || row.Nombre || row.descripcion || "").trim(),
        precio: normalizePrice(String(row.precio ?? row.Precio ?? "0")),
        stock: (() => {
            const parsed = Number(row.stock ?? row.Stock);
            return Number.isFinite(parsed) ? parsed : 100;
        })(),
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
                        const precioAsItems = precioItems.map((text, index) => ({ x: index, text }));
                        const rawPrecio = pickBestPriceCandidate(precioAsItems, 0, precioAsItems.length)?.text || "0";

                        let stock = 100;
                        for (let i = stockItems.length - 1; i >= 0; i--) {
                            const parsed = parseStockToken(stockItems[i]);
                            if (parsed !== null) {
                                stock = parsed;
                                break;
                            }
                        }

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

                        let stock = 100;
                        let stockIdx = -1;
                        for (let i = items.length - 1; i >= 1; i--) {
                            const parsed = parseStockToken(items[i].text);
                            if (parsed !== null) {
                                stock = parsed;
                                stockIdx = i;
                                break;
                            }
                        }

                        const priceUpperBound = stockIdx > 1 ? stockIdx : items.length;
                        const priceCandidate = pickBestPriceCandidate(items, 1, priceUpperBound);
                        const rawPrecio = priceCandidate?.text || "0";
                        const precioIdx = priceCandidate?.index ?? -1;

                        let endNombre = precioIdx > 0 ? precioIdx : (stockIdx > 0 ? stockIdx : items.length);
                        if (endNombre > 1 && items[endNombre - 1].text.trim() === "$") {
                            endNombre -= 1;
                        }
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

function normalizePrice(rawVal: string): number {
    let clean = rawVal.replace(/[^\d.,]/g, "");

    if (clean.length > 3 && clean[clean.length - 3] === ',') {
        clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.length > 3 && clean[clean.length - 3] === '.') {
        clean = clean.replace(/,/g, "");
    } else {
        clean = clean.replace(/[.,]/g, "");
    }

    return parseFloat(clean) || 0;
}

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
    if (products.length === 0) {
        throw new Error("El archivo de origen no contiene productos validos; se cancela la actualizacion para evitar borrar el catalogo.");
    }

    const rows = products.map(p => ({
        codigo: p.codigo,
        nombre: p.nombre,
        precio: p.precio,
        stock: p.stock,
        lista: p.lista,
    }));
    const BATCH = 500;

    const { data: backupRows, error: backupError } = await supabase
        .from("products")
        .select("*");

    if (backupError) {
        throw new Error(`No se pudo leer products antes de actualizar: ${backupError.message}`);
    }

    const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .neq("codigo", "");

    if (deleteError) {
        throw new Error(`No se pudo limpiar products antes de actualizar: ${deleteError.message}`);
    }

    try {
        for (let i = 0; i < rows.length; i += BATCH) {
            const chunk = rows.slice(i, i + BATCH);
            const { error: insertError } = await supabase.from("products").insert(chunk);
            if (insertError) throw insertError;
        }
    } catch (insertErr) {
        const insertMessage = getErrorMessage(insertErr);
        console.error("Error guardando productos en Supabase:", insertMessage);

        // Intentar rollback al estado anterior para evitar catalogo vacio.
        const { error: clearRollbackError } = await supabase
            .from("products")
            .delete()
            .neq("codigo", "");

        if (clearRollbackError) {
            throw new Error(`Fallo actualizacion de products (${insertMessage}) y no se pudo limpiar para rollback: ${clearRollbackError.message}`);
        }

        if (backupRows && backupRows.length > 0) {
            for (let i = 0; i < backupRows.length; i += BATCH) {
                const backupChunk = backupRows.slice(i, i + BATCH);
                const { error: restoreError } = await supabase.from("products").insert(backupChunk);
                if (restoreError) {
                    throw new Error(`Fallo actualizacion de products (${insertMessage}) y rollback incompleto: ${restoreError.message}`);
                }
            }
        }

        throw new Error(`Fallo actualizacion de products en Supabase: ${insertMessage}. Se restauro el catalogo anterior.`);
    }
};

export const fetchSourceFile = async (forceRefresh = false): Promise<Product[]> => {
    // Cold start: intentar cargar desde Supabase sin re-parsear el archivo
    if (!forceRefresh) {
        const fromDb = await loadProductsFromSupabase();
        if (fromDb && fromDb.length > 0) {
            return fromDb;
        }
    }

    try {
        const defaultFileName = "LISTA DE PRECIO LOCAL TACO RALO CATAMARCA.pdf";
        const localCandidates = [
            path.join(process.cwd(), defaultFileName),
            path.join(process.cwd(), "..", defaultFileName),
        ];
        let defaultLocalUrl = localCandidates[0];
        for (const candidate of localCandidates) {
            try {
                await fs.access(candidate);
                defaultLocalUrl = candidate;
                break;
            } catch {
                // Continuar buscando el archivo local de respaldo.
            }
        }

        const sourceUrl = (process.env.SOURCE_FILE_URL || defaultLocalUrl).trim();
        let fileBuffer: Buffer;
        const sourceType = (process.env.SOURCE_FILE_TYPE || "").toLowerCase();
        const isPdf = sourceType ? sourceType === "pdf" : sourceUrl.toLowerCase().endsWith(".pdf");

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

        return deduplicated;
    } catch (error) {
        console.error("Error cargando fuente:", error);
        throw error;
    }
};

export const getCurrentCatalog = async (opts?: { forceRefresh?: boolean }): Promise<Product[]> => {
    return await fetchSourceFile(opts?.forceRefresh);
};

export const loadFromBuffer = async (buffer: Buffer, type: "pdf" | "excel"): Promise<number> => {
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

    return deduplicated.length;
};

