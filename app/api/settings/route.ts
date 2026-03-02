import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { verifyAuth } from "@/lib/auth";
import { hasSomeRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await verifyAuth(token);

        const settings = await getSettings();
        return NextResponse.json({ success: true, data: settings });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        // Solo admin puede modificar settings
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (!hasSomeRole(auth, ["admin", "gerente"])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const newSettings = await updateSettings(body);

        return NextResponse.json({ success: true, data: newSettings });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
