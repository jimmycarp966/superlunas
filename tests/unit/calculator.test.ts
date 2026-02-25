import { describe, it, expect } from "vitest";

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

function calcCuota(subtotal: number, tasa: number, semanas: number, anticipo: number) {
    const total = subtotal * (1 + (tasa / 100));
    const saldo = Math.max(0, total - anticipo);
    return semanas > 0 ? saldo / semanas : saldo;
}

describe("Pricing and Normalization Tests", () => {
    it("Debería normalizar precios con diferentes formatos mixtos", () => {
        expect(normalizePrice("$ 1.234.567")).toBe(1234567);
        expect(normalizePrice("1,234,567")).toBe(1234567);
        expect(normalizePrice("1234567")).toBe(1234567);

        // decimales
        expect(normalizePrice("$ 1.234,56")).toBe(1234.56);
        expect(normalizePrice("1,234.56")).toBe(1234.56);
    });

    it("Debería calcular cuotas correctamente con anticipo", () => {
        // 1000 base, 0% interes, 0 anticipo, 10 semanas -> Cuota 100
        expect(calcCuota(1000, 0, 10, 0)).toBe(100);

        // 1000 base, 20% interes (1200), 200 anticipo -> Saldo 1000, 10 semanas -> Cuota 100
        expect(calcCuota(1000, 20, 10, 200)).toBe(100);

        // Anticipo mayor al total (debe dar 0 y saldo 0)
        expect(calcCuota(1000, 0, 10, 2000)).toBe(0);
    });
});
