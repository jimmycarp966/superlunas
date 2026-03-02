import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { buildCobranzaWindow, getCobranzaAgenda } from "@/lib/cobranzas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "encargado_cobranza",
        "cobrador",
        "cajero",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const baseDate = request.nextUrl.searchParams.get("date");
        const windowDates = buildCobranzaWindow(baseDate ? new Date(`${baseDate}T00:00:00`) : new Date());
        const fromDate = request.nextUrl.searchParams.get("from") || windowDates[0];
        const toDate = request.nextUrl.searchParams.get("to") || windowDates[windowDates.length - 1];

        const data = await getCobranzaAgenda({
            session,
            fromDate,
            toDate,
        });

        return NextResponse.json({
            success: true,
            data,
            windowDates,
            fromDate,
            toDate,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

