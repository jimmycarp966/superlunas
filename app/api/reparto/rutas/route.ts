import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { getRutasSemana } from "@/lib/reparto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "repartidor",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const data = await getRutasSemana(session);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

