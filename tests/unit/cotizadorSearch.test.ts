import { describe, expect, it } from "vitest";
import { searchProducts } from "../../app/cotizador/search";

describe("searchProducts", () => {
    const products = [
        { codigo: "32036", nombre: "AMASADORA INDUSTRIAL DE 30KG" },
        { codigo: "301", nombre: "HORNO PIZZERO TECNOC" },
        { codigo: "3", nombre: "BALANZA COMERCIAL KRETZ CENIT 30KG PARA COLGAR" },
        { codigo: "410", nombre: "CARLITERA CON ANAFE TECNOCALOR GE" },
        { codigo: "4", nombre: "BALANZA COMERCIAL SYSTEL PILON 600KG C/BATERIA Y GANCHO" },
        { codigo: "1", nombre: "BALANZA ELECTRONICA KRETZ NOVEL ECO2 30KG C/BAT CONTADORA" },
    ];

    it("prioriza coincidencias exactas de codigo antes que parciales", () => {
        const result = searchProducts(products, "3");

        expect(result.map((product) => product.codigo).slice(0, 3)).toEqual(["3", "301", "32036"]);
    });

    it("ordena primero el codigo exacto para busquedas numericas cortas", () => {
        expect(searchProducts(products, "4").map((product) => product.codigo).slice(0, 2)).toEqual(["4", "410"]);
        expect(searchProducts(products, "1")[0]?.codigo).toBe("1");
    });

    it("mantiene coincidencias por nombre cuando no hay match exacto de codigo", () => {
        const result = searchProducts(products, "balanza");

        expect(result.map((product) => product.codigo)).toEqual(["3", "4", "1"]);
    });
});
