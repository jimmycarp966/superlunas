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

const normalizeColumnKey = (key: string): string => {
    return key
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
};

const hasExcelPriceValue = (value: unknown): boolean => {
    const rawValue = String(value ?? "").trim();
    return rawValue !== "" && extractNumericToken(rawValue) !== null;
};

const isValidProductCode = (codigo: string): boolean => {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(codigo);
};

type ExcelRowLayout = {
    codigoIndex: number;
    nombreIndex: number;
    precioIndex: number;
    stockIndex: number | null;
    listaIndex: number | null;
};

type ExcelHeaderLayout = ExcelRowLayout & {
    headerRowIndex: number;
};

const parseExcelStockValue = (value: unknown, fallback = 100): number => {
    const raw = String(value ?? "").trim();
    if (raw === "") return fallback;

    const sanitized = raw.replace(/[^\d-]/g, "");
    if (sanitized === "" || sanitized === "-") return fallback;

    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const findExcelHeaderLayout = (rows: unknown[][]): ExcelHeaderLayout | null => {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex] ?? [];
        let codigoIndex = -1;
        let nombreIndex = -1;
        let precioIndex = -1;
        let stockIndex = -1;
        let listaIndex = -1;

        for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const token = normalizeColumnKey(String(row[colIndex] ?? ""));
            if (!token) continue;

            if (codigoIndex === -1 && (token === "codigo" || token === "cod" || token.startsWith("cod"))) {
                codigoIndex = colIndex;
            }

            if (nombreIndex === -1 && (
                token.includes("descripcion") ||
                token.includes("descrip") ||
                token.includes("nombre") ||
                token.includes("detalle")
            )) {
                nombreIndex = colIndex;
            }

            if (precioIndex === -1 && (
                token.includes("precio") ||
                token.includes("importe") ||
                token.includes("valor")
            )) {
                precioIndex = colIndex;
            }

            if (listaIndex === -1 && token === "lista") {
                listaIndex = colIndex;
            }

            if (stockIndex === -1 && (
                token.includes("stock") ||
                token.includes("existenc") ||
                token.includes("cantidad")
            )) {
                stockIndex = colIndex;
            }
        }

        if (codigoIndex !== -1 && nombreIndex !== -1 && precioIndex !== -1) {
            return {
                headerRowIndex: rowIndex,
                codigoIndex,
                nombreIndex,
                precioIndex,
                stockIndex: stockIndex !== -1 ? stockIndex : null,
                listaIndex: listaIndex !== -1 ? listaIndex : null,
            };
        }

        if (codigoIndex !== -1 && nombreIndex !== -1 && precioIndex === -1 && listaIndex !== -1) {
            const samples: unknown[] = [];
            for (let sampleRowIndex = rowIndex + 1; sampleRowIndex < rows.length && samples.length < 5; sampleRowIndex++) {
                const sampleValue = rows[sampleRowIndex]?.[listaIndex];
                if (String(sampleValue ?? "").trim() === "") continue;
                samples.push(sampleValue);
            }

            if (samples.length > 0 && samples.every(hasExcelPriceValue)) {
                return {
                    headerRowIndex: rowIndex,
                    codigoIndex,
                    nombreIndex,
                    precioIndex: listaIndex,
                    stockIndex: stockIndex !== -1 ? stockIndex : null,
                    listaIndex: null,
                };
            }
        }
    }

    return null;
};

const parseExcelRow = (
    row: unknown[],
    layout: ExcelRowLayout,
): Product | null => {
    const codigo = String(row[layout.codigoIndex] ?? "").trim();
    const nombre = String(row[layout.nombreIndex] ?? "").trim();
    const rawPrecio = row[layout.precioIndex];

    if (!codigo || !nombre || !hasExcelPriceValue(rawPrecio)) return null;
    if (!isValidProductCode(codigo)) return null;

    return {
        codigo,
        nombre,
        precio: normalizePrice(String(rawPrecio ?? "0")),
        stock: layout.stockIndex !== null ? parseExcelStockValue(row[layout.stockIndex]) : 100,
        lista: layout.listaIndex !== null
            ? String(row[layout.listaIndex] ?? "local").trim().toLowerCase() || "local"
            : "local",
        color: null,
        tamano: null,
        modelo: null,
        garantiaMeses: null,
        requiereSerie: false,
        numeroSerie: null,
        imagenUrl: null,
    };
};

const parseHeaderedExcelRows = (rows: unknown[][]): Product[] => {
    const layout = findExcelHeaderLayout(rows);
    if (!layout) return [];

    const products: Product[] = [];
    for (let rowIndex = layout.headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
        const product = parseExcelRow(rows[rowIndex] ?? [], layout);
        if (product) products.push(product);
    }

    return products;
};

const parseHeaderlessExcelRows = (rows: unknown[][]): Product[] => {
    const products: Product[] = [];

    // Fallback para listados sin encabezados: probamos varios desplazamientos comunes.
    let bestProducts: Product[] = [];

    for (let offset = 0; offset <= 5; offset++) {
        const layout = {
            codigoIndex: offset,
            nombreIndex: offset + 1,
            precioIndex: offset + 2,
            stockIndex: offset + 3,
            listaIndex: null,
        };

        products.length = 0;
        for (const row of rows) {
            const product = parseExcelRow(row ?? [], layout);
            if (product) products.push(product);
        }

        if (products.length > bestProducts.length) {
            bestProducts = [...products];
        }
    }

    return bestProducts;
};

export const parseExcelBuffer = (buffer: Buffer): Product[] => {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rowMatrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    const parsedWithHeaders = parseHeaderedExcelRows(rowMatrix);

    if (parsedWithHeaders.length > 0) {
        return parsedWithHeaders;
    }

    return parseHeaderlessExcelRows(rowMatrix);
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

                        if (codigo && isValidProductCode(codigo) && nombre) {
                            products.push({
                                codigo,
                                nombre,
                                precio: normalizePrice(rawPrecio),
                                stock,
                                lista: "local",
                                color: null,
                                tamano: null,
                                modelo: null,
                                garantiaMeses: null,
                                requiereSerie: false,
                                numeroSerie: null,
                                imagenUrl: null,
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

                        if (isValidProductCode(codigo) && nombre) {
                            products.push({
                                codigo,
                                nombre,
                                precio: normalizePrice(rawPrecio),
                                stock,
                                lista: "local",
                                color: null,
                                tamano: null,
                                modelo: null,
                                garantiaMeses: null,
                                requiereSerie: false,
                                numeroSerie: null,
                                imagenUrl: null,
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

        if (error || !data) return null;

        return (data as Record<string, unknown>[]).map(row => ({
            codigo: String(row.codigo),
            nombre: String(row.nombre),
            precio: Number(row.precio),
            stock: Number(row.stock),
            lista: String(row.lista),
            color: row.color ? String(row.color) : null,
            tamano: row.tamano ? String(row.tamano) : null,
            modelo: row.modelo ? String(row.modelo) : null,
            garantiaMeses: row.garantia_meses ? Number(row.garantia_meses) : null,
            requiereSerie: Boolean(row.requiere_serie ?? false),
            numeroSerie: row.numero_serie ? String(row.numero_serie) : null,
            imagenUrl: row.imagen_url ? String(row.imagen_url) : null,
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
        color: p.color ?? null,
        tamano: p.tamano ?? null,
        modelo: p.modelo ?? null,
        garantia_meses: p.garantiaMeses ?? null,
        requiere_serie: Boolean(p.requiereSerie ?? false),
        numero_serie: p.numeroSerie ?? null,
        imagen_url: p.imagenUrl ?? null,
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
    // Flujo normal: leer SIEMPRE desde Supabase, incluso si esta vacio.
    // Solo se re-parsea fuente cuando forceRefresh=true (boton Recargar/Subir).
    if (!forceRefresh) {
        const fromDb = await loadProductsFromSupabase();
        if (fromDb !== null) {
            return fromDb;
        }

        throw new Error("No se pudo leer el catalogo desde Supabase.");
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


