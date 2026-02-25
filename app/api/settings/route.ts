import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { verifyAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const settings = getSettings();
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
        if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const newSettings = updateSettings(body);

        return NextResponse.json({ success: true, data: newSettings });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
