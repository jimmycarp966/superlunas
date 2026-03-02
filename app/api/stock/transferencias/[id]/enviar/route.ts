import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { aprobarYEnviarTransferenciaStock } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const { session, errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "cajero",
    ]);
    if (errorResponse || !session) return errorResponse as NextResponse;

    try {
        const { id } = await context.params;
        const data = await aprobarYEnviarTransferenciaStock({
            session,
            transferenciaId: id,
        });
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

