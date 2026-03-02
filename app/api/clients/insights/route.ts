import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getClientsInsights } from "@/lib/registrations";
import { hasSomeRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (!hasSomeRole(auth, ["admin", "gerente", "auditor", "encargado_cobranza"])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const insights = await getClientsInsights();
        return NextResponse.json({ success: true, data: insights });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
