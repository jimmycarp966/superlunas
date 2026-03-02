import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { imputarPagoCobranza } from "@/lib/cobranzas";
import { isCorporateRole } from "@/lib/roles";

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
        const canOverrideDifference = isCorporateRole(session.role);
        const data = await imputarPagoCobranza({
            session,
            agendaId: String(body?.agendaId ?? ""),
            monto: Number(body?.monto ?? 0),
            fechaImputacion: String(body?.fechaImputacion ?? ""),
            fechaDeudaObjetivo: String(body?.fechaDeudaObjetivo ?? ""),
            medioPago: body?.medioPago ? String(body.medioPago) : undefined,
            observaciones: body?.observaciones ? String(body.observaciones) : undefined,
            allowDifference: canOverrideDifference && Boolean(body?.allowDifference),
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
