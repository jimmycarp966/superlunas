import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import {
    getRegistrations,
    addRegistration,
    getRegistrationsByVendedorMesActual,
} from "@/lib/registrations";
import { hasSomeRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (!hasSomeRole(auth, ["admin", "gerente", "auditor", "vendedor", "cobrador"])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (auth.role === "vendedor" || auth.role === "cobrador") {
            const vendedor = auth.nombre ?? auth.username ?? "";
            const own = await getRegistrationsByVendedorMesActual(vendedor);
            return NextResponse.json({ success: true, data: own });
        }
        return NextResponse.json({ success: true, data: await getRegistrations() });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (!hasSomeRole(auth, ["admin", "gerente", "vendedor", "cobrador"])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const body = await request.json();
        const reg = await addRegistration(body, auth);
        return NextResponse.json({ success: true, data: reg });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
