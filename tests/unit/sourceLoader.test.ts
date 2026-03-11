import { describe, expect, it } from "vitest";
import * as xlsx from "xlsx";
import { parseExcelBuffer } from "../../lib/sourceLoader";

const buildWorkbookBuffer = (rows: unknown[][]): Buffer => {
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, "Hoja1");
    return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

describe("parseExcelBuffer", () => {
    it("parsea catalogos con encabezados normalizados", () => {
        const buffer = buildWorkbookBuffer([
            ["CODIGO", "DESCRIPCION", "PRECIO", "STOCK", "LISTA"],
            ["1001", "Anafe 2 hornallas", "123.456", 4, "local"],
            ["1002", "Amasadora 20kg", "0.00", "0.000", "valles"],
        ]);

        const products = parseExcelBuffer(buffer);

        expect(products).toEqual([
            expect.objectContaining({
                codigo: "1001",
                nombre: "Anafe 2 hornallas",
                precio: 123456,
                stock: 4,
                lista: "local",
            }),
            expect.objectContaining({
                codigo: "1002",
                nombre: "Amasadora 20kg",
                precio: 0,
                stock: 0,
                lista: "valles",
            }),
        ]);
    });

    it("parsea listas sin encabezados como LISTA PRECIOS ACT", () => {
        const buffer = buildWorkbookBuffer([
            ["Lista de Precios", "", 46092, "", ""],
            ["", "", "", "", ""],
            ["01-EQUIPAMIE", "OS COMERCIALES", "", "", ""],
            [31708, "AMASADORA INDUSTRIAL DE 20KG MARTINO", 1977522, 2, ""],
            [32036, "AMASADORA INDUSTRIAL DE 30KG FREIRE C/MANDO", 3485767, "0.000", ""],
            [31531, "AMASADORA INDUSTRIAL DE 50KG MARTINO C/MANDO", "0.00", "0.000", ""],
        ]);

        const products = parseExcelBuffer(buffer);

        expect(products).toHaveLength(3);
        expect(products[0]).toEqual(expect.objectContaining({
            codigo: "31708",
            nombre: "AMASADORA INDUSTRIAL DE 20KG MARTINO",
            precio: 1977522,
            stock: 2,
            lista: "local",
        }));
        expect(products[1]).toEqual(expect.objectContaining({
            codigo: "32036",
            precio: 3485767,
            stock: 0,
        }));
        expect(products[2]).toEqual(expect.objectContaining({
            codigo: "31531",
            precio: 0,
            stock: 0,
        }));
    });
});
