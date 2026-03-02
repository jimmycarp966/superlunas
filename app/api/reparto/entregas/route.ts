import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { registrarEntregaReparto } from "@/lib/reparto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "repartidor",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const body = await request.json();
        const data = await registrarEntregaReparto({
            session,
            rutaId: String(body?.rutaId ?? ""),
            cliente: String(body?.cliente ?? ""),
            direccion: String(body?.direccion ?? ""),
            firmaUrl: body?.firmaUrl ? String(body.firmaUrl) : undefined,
            fotoEntregaUrl: body?.fotoEntregaUrl ? String(body.fotoEntregaUrl) : undefined,
            checklistCamion: body?.checklistCamion ?? {},
            lat: body?.lat !== undefined ? Number(body.lat) : null,
            lng: body?.lng !== undefined ? Number(body.lng) : null,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

