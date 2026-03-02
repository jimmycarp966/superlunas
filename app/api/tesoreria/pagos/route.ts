import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { registrarPagoTesoreria } from "@/lib/tesoreria";
import { supabase } from "@/lib/supabase";
import { isCorporateRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "cajero",
        "contador",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        let query = supabase
            .from("tesoreria_pagos")
            .select("*")
            .order("fecha_imputacion", { ascending: false })
            .limit(50);

        if (!isCorporateRole(session.role)) {
            if (!session.sucursalId) {
                return NextResponse.json(
                    { success: false, error: "Usuario sin sucursal asignada." },
                    { status: 403 },
                );
            }
            query = query.eq("sucursal_id", session.sucursalId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true, data: data ?? [] });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "cajero",
        "contador",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const body = await request.json();
        const canOverrideRules = isCorporateRole(session.role);
        if (!canOverrideRules && !session.sucursalId) {
            return NextResponse.json(
                { success: false, error: "Usuario sin sucursal asignada." },
                { status: 403 },
            );
        }
        const data = await registrarPagoTesoreria({
            session,
            cliente: String(body?.cliente ?? ""),
            dni: String(body?.dni ?? ""),
            monto: Number(body?.monto ?? 0),
            montoEsperado: Number(body?.montoEsperado ?? 0),
            fechaImputacion: String(body?.fechaImputacion ?? ""),
            fechaDeudaObjetivo: String(body?.fechaDeudaObjetivo ?? ""),
            medioPago: (body?.medioPago ?? "efectivo") as
                | "efectivo"
                | "transferencia"
                | "debito"
                | "credito"
                | "otro",
            observaciones: body?.observaciones ? String(body.observaciones) : undefined,
            sucursalId: session.sucursalId ?? null,
            allowDifference: canOverrideRules && Boolean(body?.allowDifference),
            allowOverpay: canOverrideRules && Boolean(body?.allowOverpay),
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
