import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { registrarRendicionCobranza } from "@/lib/cobranzas";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "encargado_cobranza",
        "cobrador",
        "cajero",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const body = await request.json();
        let isCatamarca = false;
        if (session.sucursalId) {
            const { data } = await supabase
                .from("sucursales")
                .select("codigo")
                .eq("id", session.sucursalId)
                .maybeSingle();
            const codigo = String((data as { codigo?: string } | null)?.codigo ?? "").toLowerCase();
            isCatamarca = codigo === "catamarca";
        }
        const destino = isCatamarca ? "encargado" : "cajero";

        const data = await registrarRendicionCobranza({
            session,
            fecha: String(body?.fecha ?? new Date().toISOString().slice(0, 10)),
            sucursalId: session.sucursalId ?? null,
            montoTotal: Number(body?.montoTotal ?? 0),
            destino,
            observaciones: body?.observaciones ? String(body.observaciones) : undefined,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
