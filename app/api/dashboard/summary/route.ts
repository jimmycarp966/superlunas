import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { isCorporateRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const safeCount = async (table: string): Promise<number> => {
    const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
    if (error) return 0;
    return count ?? 0;
};

export async function GET(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "contador",
        "encargado_cobranza",
        "auditor",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const scopedBySucursal = !isCorporateRole(session.role) && !!session.sucursalId;
        if (!isCorporateRole(session.role) && !session.sucursalId) {
            return NextResponse.json(
                { success: false, error: "Usuario sin sucursal asignada." },
                { status: 403 },
            );
        }

        const creditosAuditoriaQuery = supabase
            .from("creditos_solicitudes")
            .select("*", { count: "exact", head: true })
            .eq("estado", "pendiente_auditoria");
        const creditosEncargadoQuery = supabase
            .from("creditos_solicitudes")
            .select("*", { count: "exact", head: true })
            .eq("estado", "pendiente_encargado");
        const creditosRepartidorQuery = supabase
            .from("creditos_solicitudes")
            .select("*", { count: "exact", head: true })
            .eq("estado", "pendiente_repartidor");
        const cobranzasPendientesQuery = supabase
            .from("cobranzas_agenda")
            .select("*", { count: "exact", head: true })
            .eq("estado", "pendiente");
        const pagosTesoreriaQuery = supabase
            .from("tesoreria_pagos")
            .select("monto");

        if (scopedBySucursal) {
            creditosAuditoriaQuery.eq("sucursal_id", session.sucursalId as string);
            creditosEncargadoQuery.eq("sucursal_id", session.sucursalId as string);
            creditosRepartidorQuery.eq("sucursal_id", session.sucursalId as string);
            cobranzasPendientesQuery.eq("sucursal_id", session.sucursalId as string);
            pagosTesoreriaQuery.eq("sucursal_id", session.sucursalId as string);
        }

        const [
            productos,
            clientes,
            creditosPendientesAuditoria,
            creditosPendientesEncargado,
            creditosPendientesRepartidor,
            cobranzasPendientes,
            pagosTesoreria,
        ] = await Promise.all([
            safeCount("products"),
            safeCount("clients"),
            creditosAuditoriaQuery,
            creditosEncargadoQuery,
            creditosRepartidorQuery,
            cobranzasPendientesQuery,
            pagosTesoreriaQuery,
        ]);

        const pagosAcumulados = Array.isArray(pagosTesoreria.data)
            ? pagosTesoreria.data.reduce((acc, row) => acc + Number((row as { monto: number }).monto || 0), 0)
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                productos,
                clientes,
                creditosPendientesAuditoria: creditosPendientesAuditoria.count ?? 0,
                creditosPendientesEncargado: creditosPendientesEncargado.count ?? 0,
                creditosPendientesRepartidor: creditosPendientesRepartidor.count ?? 0,
                cobranzasPendientes: cobranzasPendientes.count ?? 0,
                pagosAcumulados,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
