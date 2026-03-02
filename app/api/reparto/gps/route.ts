import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { registrarGpsRepartidor } from "@/lib/reparto";

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
        const lat = Number(body?.lat);
        const lng = Number(body?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return NextResponse.json(
                { success: false, error: "Coordenadas invalidas." },
                { status: 400 },
            );
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return NextResponse.json(
                { success: false, error: "Coordenadas fuera de rango." },
                { status: 400 },
            );
        }
        await registrarGpsRepartidor({
            session,
            lat,
            lng,
            accuracy: body?.accuracy !== undefined ? Number(body.accuracy) : null,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
