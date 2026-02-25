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
    primeraCuotaMap: Record<string, boolean> = {}
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
        ? `${p.semanas} SEMANAS (1RA PAGA + ${p.cuotasPendientes} de $${formatARS(p.cuota)})`
        : `${p.semanas} SEMANAS (${p.semanas} de $${formatARS(p.cuota)})`;
    if (p.badge) t += ` (${p.badge.toUpperCase()})`;
    return t;
};

const todayStr = (): string => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// Elimina prefijos [CODIGO] del texto de productos
const stripCodes = (text: string): string =>
    text.replace(/\[\w[\w-]*\]\s*/g, "").trim();

// ── Formato PRESUPUESTO (botón COPIAR en el cotizador) ────────────────────────
export const generatePresupuestoText = (
    calc: { subtotal: number; anticipo: number; itemsText: string; planStats: any[] }
): string => {
    if (calc.subtotal === 0) return "";

    const lines: string[] = [];
    lines.push("PRESUPUESTO");
    lines.push("----------------------------------------");
    lines.push(`* PRODUCTO: ${stripCodes(calc.itemsText)}`);
    lines.push("");
    lines.push("OPCIONES DE FINANCIACIÓN:");
    lines.push("");

    for (const p of calc.planStats) {
        if (p.semanas === 0) {
            lines.push(`* CONTADO`);
            lines.push(`  Un pago de $ ${formatARS(p.calcTotal)}`);
        } else {
            lines.push(`* ${p.semanas} SEMANAS`);
            if (p.primeraCuotaPaga) {
                lines.push(`  Quedan ${p.cuotasPendientes} cuotas de $ ${formatARS(p.cuota)}`);
                lines.push(`  Saldo restante: $ ${formatARS(p.saldo)}`);
            } else {
                lines.push(`  ${p.semanas} semanas de $ ${formatARS(p.cuota)}`);
            }
        }
        lines.push("");
    }

    lines.push("____________");
    lines.push(`Fecha: ${todayStr()} - Precios sujetos a modificación sin previo aviso.`);

    return lines.join("\n");
};

// ── Formato NOTA DE PEDIDO (botón WhatsApp / Copiar en la ficha) ───────────────
export const generateNotaPedidoText = (
    calc: { subtotal: number; anticipo: number; itemsText: string; planStats: any[] },
    opts: {
        vendedor: string;
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
    }
): string => {
    const sep = "----------------------------";
    const plan = calc.planStats.find(p => p.id === opts.selectedPlanId);

    let planLine = "";
    let totalLine = "";
    if (plan) {
        if (plan.semanas === 0) {
            planLine = `CONTADO (1 pago de $${formatARS(plan.calcTotal)})`;
            totalLine = formatARS(plan.calcTotal);
        } else {
            if (plan.primeraCuotaPaga) {
                planLine = `${plan.semanas} SEMANAS (${plan.cuotasPendientes} de $${formatARS(plan.cuota)})`;
                totalLine = formatARS(plan.saldo);
            } else {
                planLine = `${plan.semanas} SEMANAS (${plan.semanas} de $${formatARS(plan.cuota)})`;
                totalLine = formatARS(plan.calcTotal);
            }
        }
    }

    const nroStr = opts.nroCliente ? ` [CLIENTE Nº: ${opts.nroCliente}]` : "";

    return [
        `* NOTA DE PEDIDO - LUNAS 2026`,
        `* RESERVA Y AUTORIZACION ZONA ${opts.zona.toUpperCase()}`,
        sep,
        ` VEND : ${opts.vendedor.toUpperCase()}`,
        ` ZONA : ${opts.zona.toUpperCase()}`,
        sep,
        `[ CLIENTE ]`,
        `Nombre : ${opts.cliente}${nroStr}`,
        `DNI : ${opts.dni}`,
        `TEL : ${opts.telefono}`,
        `LOC : ${opts.localidad}`,
        `RUBRO : ${opts.rubro}`,
        `DOM. COM : ${opts.domCom}`,
        `DOM. PAR : ${opts.domPar}`,
        sep,
        `>> PRODUCTO : ${calc.itemsText}`,
        `    PLAN : ${planLine}`,
        `    TOTAL VENTA (FINAL) : $${totalLine}`,
        ``,
        `ANTICIPO : $ ${calc.anticipo > 0 ? formatARS(calc.anticipo) : ""}`,
        todayStr(),
    ].filter(Boolean).join("\n");
};
