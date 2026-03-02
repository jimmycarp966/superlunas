import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { crearTransferenciaStockManual } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "cajero",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        let query = supabase
            .from("transferencias_stock")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);
        if (session.role === "cajero" && session.sucursalId) {
            query = query.or(
                `sucursal_origen_id.eq.${session.sucursalId},sucursal_destino_id.eq.${session.sucursalId}`,
            );
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
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const body = await request.json();
        const transferencia = await crearTransferenciaStockManual({
            session,
            productCodigo: String(body?.productCodigo ?? ""),
            sucursalOrigenId: String(body?.sucursalOrigenId ?? session.sucursalId ?? ""),
            sucursalDestinoId: String(body?.sucursalDestinoId ?? ""),
            cantidad: Number(body?.cantidad ?? 0),
        });
        return NextResponse.json({ success: true, data: transferencia });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

