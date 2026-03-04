/* eslint-disable @typescript-eslint/no-explicit-any */

export const formatARS = (n: number): string =>
    Math.round(n).toLocaleString("es-AR");

const roundUpToHundred = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.ceil(value / 100) * 100;
};

export function calcPlanStats(
    subtotal: number,
    anticipo: number,
    plans: any[],
    _settings: any,
    primeraCuotaMap: Record<string, boolean> = {},
) {
    return plans.map((p) => {
        const rawRate = Number(p.tasaPorcentaje);
        const rate = Number.isFinite(rawRate) ? rawRate : 0;
        const semanas = Number(p.semanas) || 0;
        const baseConAnticipo = Math.max(0, subtotal - anticipo);
        const totalBase = roundUpToHundred(baseConAnticipo * (1 + rate / 100));

        if (semanas <= 0) {
            return {
                ...p,
                calcTotal: totalBase,
                saldo: totalBase,
                cuota: totalBase,
                primeraCuotaPaga: false,
                cuotasPendientes: 0,
                pagoInicial: 0,
            };
        }

        const cuota = roundUpToHundred(totalBase / semanas);
        const calcTotal = cuota * semanas;
        const primeraCuotaPaga = Boolean(primeraCuotaMap[String(p.id)]);
        const cuotasPendientes = primeraCuotaPaga ? Math.max(0, semanas - 1) : semanas;
        const pagoInicial = primeraCuotaPaga ? cuota : 0;
        const saldo = primeraCuotaPaga ? Math.max(0, calcTotal - pagoInicial) : calcTotal;

        return {
            ...p,
            calcTotal,
            saldo,
            cuota,
            primeraCuotaPaga,
            cuotasPendientes,
            pagoInicial,
        };
    });
}

export const planToText = (p: any): string => {
    if (p.semanas === 0) return `CONTADO ($${formatARS(p.calcTotal)})`;
    let t = p.primeraCuotaPaga
        ? `${p.semanas} SEMANAS (1RA PAGA + ${p.cuotasPendientes} DE $${formatARS(p.cuota)})`
        : `${p.semanas} SEMANAS (${p.semanas} DE $${formatARS(p.cuota)})`;
    if (p.badge) t += ` (${String(p.badge).toUpperCase()})`;
    return t;
};

const todayStr = (): string => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const stripCodes = (text: string): string =>
    text.replace(/\[\w[\w-]*\]\s*/g, "").trim();

const splitItemsLines = (itemsText: string): string[] =>
    String(itemsText ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

export const generatePresupuestoText = (
    calc: { subtotal: number; anticipo: number; itemsText: string; planStats: any[] },
): string => {
    if (calc.subtotal === 0) return "";

    const lines: string[] = [];
    const productLines = splitItemsLines(calc.itemsText);
    lines.push("PRESUPUESTO");
    lines.push("----------------------------------------");
    if (productLines.length <= 1) {
        lines.push(`* PRODUCTO: ${stripCodes(productLines[0] ?? "")}`);
    } else {
        lines.push("* PRODUCTOS:");
        productLines.forEach((line) => {
            lines.push(`  - ${stripCodes(line)}`);
        });
    }
    lines.push("");
    lines.push("OPCIONES DE FINANCIACION:");
    lines.push("");

    for (const p of calc.planStats) {
        if (p.semanas === 0) {
            lines.push("* CONTADO");
            lines.push(`  UN PAGO DE $ ${formatARS(p.calcTotal)}`);
        } else {
            lines.push(`* ${p.semanas} SEMANAS`);
            if (p.primeraCuotaPaga) {
                lines.push(`  QUEDAN ${p.cuotasPendientes} CUOTAS DE $ ${formatARS(p.cuota)}`);
                lines.push(`  SALDO RESTANTE: $ ${formatARS(p.saldo)}`);
            } else {
                lines.push(`  ${p.semanas} SEMANAS DE $ ${formatARS(p.cuota)}`);
            }
        }
        lines.push("");
    }

    lines.push("____________");
    lines.push(`FECHA: ${todayStr()} - PRECIOS SUJETOS A MODIFICACION SIN PREVIO AVISO.`);

    return lines.join("\n");
};

export const generateNotaPedidoText = (
    calc: { subtotal: number; anticipo: number; itemsText: string; planStats: any[] },
    opts: {
        vendedor: string;
        vendedorTelefono: string;
        zona: string;
        cliente: string;
        nroCliente: string;
        dni: string;
        telefono: string;
        localidad: string;
        rubro: string;
        domCom: string;
        domPar: string;
        selectedPlanId: string;
        conyugue?: string;
        dniConyugue?: string;
        telConyugue?: string;
        specialFinancing?: {
            semanas: number;
            monto: number;
        };
    },
): string => {
    const upper = (value: string | null | undefined): string =>
        String(value ?? "").trim().toUpperCase();
    const sep = "========================================";
    const line = (label: string, value: string): string =>
        `${label.padEnd(18, " ")}: ${upper(value) || "-"}`;

    const specialWeeks = Math.max(0, Number(opts.specialFinancing?.semanas) || 0);
    const specialAmount = Math.max(0, Number(opts.specialFinancing?.monto) || 0);
    const hasSpecialFinancing = specialWeeks > 0 && specialAmount > 0;

    const plan = calc.planStats.find((p) => String(p.id) === String(opts.selectedPlanId));
    const productLines = splitItemsLines(calc.itemsText);
    const firstProductLine = productLines[0] ?? (hasSpecialFinancing ? "FINANCIACION ESPECIAL" : "");
    const productSection =
        productLines.length <= 1
            ? [line("PRODUCTO", firstProductLine)]
            : [`${"PRODUCTOS".padEnd(18, " ")}:`, ...productLines.map((item) => `  - ${upper(item)}`)];

    let planLine = "";
    let totalLine = "";
    if (hasSpecialFinancing) {
        planLine = `FINANCIACION ESPECIAL (${specialWeeks} SEMANAS DE $${formatARS(specialAmount)})`;
        totalLine = formatARS(specialWeeks * specialAmount);
    } else if (plan) {
        if (plan.semanas === 0) {
            planLine = `CONTADO (1 PAGO DE $${formatARS(plan.calcTotal)})`;
            totalLine = formatARS(plan.calcTotal);
        } else if (plan.primeraCuotaPaga) {
            planLine = `${plan.semanas} SEMANAS (${plan.cuotasPendientes} DE $${formatARS(plan.cuota)})`;
            totalLine = formatARS(plan.saldo);
        } else {
            planLine = `${plan.semanas} SEMANAS (${plan.semanas} DE $${formatARS(plan.cuota)})`;
            totalLine = formatARS(plan.calcTotal);
        }
    }

    const nroStr = opts.nroCliente ? ` [CODIGO: ${upper(opts.nroCliente)}]` : "";

    const conyugueLines = opts.conyugue?.trim()
        ? [
              sep,
              "[ CONYUGE / CO-TITULAR ]",
              line("NOMBRE", opts.conyugue),
              opts.dniConyugue?.trim() ? line("DNI", opts.dniConyugue) : "",
              opts.telConyugue?.trim() ? line("TELEFONO", opts.telConyugue) : "",
          ].filter(Boolean)
        : [];

    return [
        "* NOTA DE PEDIDO - LUNAS 2026",
        `* RESERVA Y AUTORIZACION ZONA ${upper(opts.zona)}`,
        sep,
        line("VENDEDOR", opts.vendedor),
        line("TEL. VENDEDOR", opts.vendedorTelefono),
        line("ZONA", opts.zona),
        sep,
        "[ CLIENTE ]",
        line("NOMBRE", `${upper(opts.cliente)}${nroStr}`),
        line("DNI", opts.dni),
        line("TELEFONO", opts.telefono),
        line("LOCALIDAD", opts.localidad),
        line("RUBRO", opts.rubro),
        line("DOM. COMERCIAL", opts.domCom),
        line("DOM. PARTICULAR", opts.domPar),
        ...conyugueLines,
        sep,
        ...productSection,
        line("PLAN", planLine),
        line("TOTAL VENTA", `$${totalLine || "0"}`),
        line("ANTICIPO", calc.anticipo > 0 ? `$${formatARS(calc.anticipo)}` : "$0"),
        "",
        todayStr(),
    ]
        .filter(Boolean)
        .join("\n");
};
