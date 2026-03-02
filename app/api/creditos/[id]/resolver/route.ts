import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { resolverCreditoSolicitud } from "@/lib/creditos";

export const dynamic = "force-dynamic";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "auditor",
        "encargado_cobranza",
        "repartidor",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const { id } = await context.params;
        const body = await request.json();
        const approve = Boolean(body?.approve);
        const result = await resolverCreditoSolicitud(session, {
            creditoId: id,
            approve,
            comentario: body?.comentario ? String(body.comentario) : undefined,
            informeComercialUrl: body?.informeComercialUrl ? String(body.informeComercialUrl) : undefined,
        });
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

