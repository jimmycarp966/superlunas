/* eslint-disable @typescript-eslint/no-explicit-any */

export const formatARS = (n: number): string =>
    Math.round(n).toLocaleString("es-AR");

export function calcPlanStats(subtotal: number, anticipo: number, plans: any[], settings: any) {
    const round = (num: number, dec: number) => Math.round(num * Math.pow(10, dec)) / Math.pow(10, dec);
    const rdTotal = settings?.redondeoTotal ?? 2;
    const rdCuota = settings?.redondeoCuota ?? 2;
    return plans.map(p => {
        let calcTotal = subtotal;
        if (p.tasaPorcentaje > 0) calcTotal = subtotal * (1 + p.tasaPorcentaje / 100);
        calcTotal = round(calcTotal, rdTotal);
        const saldo = Math.max(0, calcTotal - anticipo);
        const cuota = p.semanas > 0 ? round(saldo / p.semanas, rdCuota) : saldo;
        return { ...p, calcTotal, saldo, cuota };
    });
}

export const planToText = (p: any): string => {
    if (p.semanas === 0) return `CONTADO ($${formatARS(p.calcTotal)})`;
    let t = `${p.semanas} SEMANAS (${p.semanas} de $${formatARS(p.cuota)})`;
    if (p.badge) t += ` (${p.badge.toUpperCase()})`;
    return t;
};

export const generateFichaText = (
    calc: { subtotal: number; anticipo: number; itemsText: string; planStats: any[] },
    opts?: { clienteName?: string; localidad?: string; selectedPlanId?: string }
): string => {
    if (calc.subtotal === 0) return "";
    const { clienteName, localidad, selectedPlanId } = opts || {};
    const lines: string[] = ["*COTIZACIÓN - LUNAS CONFORT*", ""];

    if (clienteName) {
        lines.push(`*Cliente:* ${clienteName.toUpperCase()}`);
        if (localidad) lines.push(`*Localidad:* ${localidad}`);
        lines.push("");
    }

    lines.push("*Productos:*");
    calc.itemsText.split(",").forEach(i => { const t = i.trim(); if (t) lines.push(`• ${t}`); });
    lines.push("");

    const plans = selectedPlanId ? calc.planStats.filter(p => p.id === selectedPlanId) : calc.planStats;
    lines.push("*Opciones de pago:*");
    plans.forEach(p => lines.push(planToText(p)));

    if (calc.anticipo > 0) {
        lines.push("");
        lines.push(`*Anticipo:* $ ${formatARS(calc.anticipo)}`);
    }

    lines.push("", "_Cotización válida por hoy. Sujeta a modificaciones._");
    return lines.join("\n");
};
