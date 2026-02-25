import { Product, CatalogCache } from "./types";
import * as xlsx from "xlsx";
import fs from "fs/promises";
import path from "path";

// @ts-ignore
const PDFParser = require("pdf2json");

// Variables globales para cache en node
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "600") * 1000;

// Declaramos explicitamente de modo que resista al hot-reload en dev
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
        stock: Number(row.stock || row.Stock || 100), // Default 100 si no hay
        lista: String(row.lista || row.Lista || "local").trim().toLowerCase(),
    })).filter(p => p.codigo !== "");
};

const parsePdfBuffer = async (buffer: Buffer): Promise<Product[]> => {
    return new Promise((resolve) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", (errData: any) => {
            console.error("Error parseando PDF:", errData.parserError);
            resolve([]);
        });

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const products: Product[] = [];

            // Recorrer todas las páginas
            for (const page of pdfData.Pages || []) {
                const texts = page.Texts || [];

                // Agrupar elementos por línea (coordenada Y redondeada)
                const linesMap = new Map<number, { x: number, text: string }[]>();

                for (const t of texts) {
                    const y = Math.round(t.y * 10) / 10; // Redondear a 1 decimal aproxima lineas visuales
                    const txt = decodeURIComponent(t.R[0].T).trim();
                    if (!txt) continue;

                    if (!linesMap.has(y)) linesMap.set(y, []);
                    linesMap.get(y)!.push({ x: t.x, text: txt });
                }

                // Para cada línea, ordenar por X y extraer datos
                const yKeys = Array.from(linesMap.keys()).sort((a, b) => a - b);

                for (const y of yKeys) {
                    const items = linesMap.get(y)!.sort((a, b) => a.x - b.x);

                    // Necesitamos al menos Código, Nombre y Precio
                    if (items.length >= 3) {
                        // Basado en el volcado:
                        // items[0] suele ser Codigo (x ~ 5)
                        // items[1] suele ser Nombre (x ~ 7)
                        // items[...] el último elemento numérico suele ser el precio (x ~ 28 o 30)

                        const codigo = items[0].text;
                        const nombre = items[1].text;

                        // Ignoramos la cabecera
                        if (codigo.toLowerCase().includes("codigo")) continue;

                        // Buscamos el precio (el item más a la derecha que parezca número/precio)
                        // Generalmente items.length - 1 o -2 (si hay un stock/lista suelto al final)
                        let rawPrecio = "0";
                        for (let i = items.length - 1; i >= 1; i--) {
                            // Si tiene formato de numero de precio ej 435.999
                            const clean = items[i].text.replace(/[^\d.,]/g, "");
                            if (clean.length > 0 && /\d/.test(clean)) {
                                rawPrecio = items[i].text;
                                // Si casualmente agarramos el simbolo $ o la palabra LISTA, seguimos iterando
                                if (rawPrecio === "$" || rawPrecio.toLowerCase() === "lista") continue;
                                break;
                            }
                        }

                        // Verificación basica: que el codigo se parezca a un codigo (al menos 3 numeros u letras)
                        if (/^[a-zA-Z0-9-]{3,}$/.test(codigo)) {
                            products.push({
                                codigo: codigo,
                                nombre: nombre,
                                precio: normalizePrice(rawPrecio),
                                stock: 100,
                                lista: "local"
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
    // Limpia el precio $ 1.234,56 -> 1234.56
    // o $ 1,234.56 -> 1234.56
    let clean = rawVal.replace(/[^\d.,]/g, "");

    // Heuristica: si hay una coma y esta al final (-3), es separador decimal
    if (clean.length > 3 && clean[clean.length - 3] === ',') {
        clean = clean.replace(/\./g, "").replace(",", ".");
    } else if (clean.length > 3 && clean[clean.length - 3] === '.') {
        clean = clean.replace(/,/g, ""); // formato americano, quita las comas miles
    } else {
        // quita puntos y comas de todo
        clean = clean.replace(/[.,]/g, "");
    }

    return parseFloat(clean) || 0;
};

export const fetchSourceFile = async (forceRefresh = false): Promise<Product[]> => {
    const now = Date.now();

    if (!forceRefresh && global.catalogCache) {
        if (now - global.catalogCache.updatedAt < CACHE_TTL) {
            return global.catalogCache.data;
        }
    }

    try {
        const defaultLocalUrl = path.join(process.cwd(), "..", "LISTA DE PRECIO LOCAL TACO RALO CATAMARCA.pdf");
        const sourceUrl = process.env.SOURCE_FILE_URL || defaultLocalUrl;
        let fileBuffer: Buffer;
        let isPdf = process.env.SOURCE_FILE_TYPE === 'pdf' || defaultLocalUrl.toLowerCase().endsWith('.pdf');

        if (sourceUrl.startsWith('http')) {
            // Fetch externo
            const opts: RequestInit = {};
            if (process.env.SOURCE_AUTH_TOKEN) {
                opts.headers = { Authorization: `Bearer ${process.env.SOURCE_AUTH_TOKEN}` };
            }
            const response = await fetch(sourceUrl, opts);
            if (!response.ok) throw new Error("Fallo descarga remota");
            fileBuffer = Buffer.from(await response.arrayBuffer());
        } else {
            // Fetch local fallback
            fileBuffer = await fs.readFile(sourceUrl);
        }

        let rawProducts: Product[] = [];
        if (isPdf) {
            rawProducts = await parsePdfBuffer(fileBuffer);
        } else {
            rawProducts = parseExcelBuffer(fileBuffer);
        }

        // Deduplicate array by codigo+lista
        const deduplicated = Array.from(new Map(
            rawProducts.map(p => [`${p.codigo}-${p.lista}`, p])
        ).values());

        global.catalogCache = {
            data: deduplicated,
            updatedAt: now,
            sourceVersion: `${now}-${deduplicated.length}`, // Simulamos un hash rapido
        };

        return deduplicated;
    } catch (error) {
        console.error("Error cargando fuente:", error);
        if (global.catalogCache) {
            console.warn("Retornando catalogo anterior estandar");
            return global.catalogCache.data; // Fallback
        }
        throw error;
    }
};

export const getCurrentCatalog = async (opts?: { forceRefresh?: boolean }): Promise<Product[]> => {
    return await fetchSourceFile(opts?.forceRefresh);
};

// Carga directamente desde un buffer en memoria (para uploads sin escritura en disco)
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

    global.catalogCache = {
        data: deduplicated,
        updatedAt: now,
        sourceVersion: `${now}-${deduplicated.length}`,
    };

    return deduplicated.length;
};
