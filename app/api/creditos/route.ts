import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { crearCreditoSolicitud, getCreditosSolicitudes, parseAmountLoose } from "@/lib/creditos";

export const dynamic = "force-dynamic";

const ALLOWED_VIEW_ROLES = [
    "admin",
    "gerente",
    "auditor",
    "encargado_cobranza",
    "repartidor",
    "vendedor",
    "cobrador",
] as const;

export async function GET(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [...ALLOWED_VIEW_ROLES]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const data = await getCreditosSolicitudes(session);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "vendedor",
        "cobrador",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const body = await request.json();
        const vendedorFromSession = String(session.nombre ?? session.username ?? "").trim();
        const vendedor =
            session.role === "vendedor" || session.role === "cobrador"
                ? vendedorFromSession
                : String(body?.vendedor ?? vendedorFromSession);

        const credito = await crearCreditoSolicitud(session, {
            cliente: String(body?.cliente ?? ""),
            dni: String(body?.dni ?? ""),
            vendedor,
            zona: String(body?.zona ?? session.zona ?? ""),
            total: parseAmountLoose(body?.total),
            informeComercialUrl: body?.informeComercialUrl ? String(body.informeComercialUrl) : null,
            observaciones: body?.observaciones ? String(body.observaciones) : null,
        });
        return NextResponse.json({ success: true, data: credito });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
