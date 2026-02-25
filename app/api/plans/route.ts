import { NextRequest, NextResponse } from "next/server";
import { getPlans, updatePlans } from "@/lib/settings";
import { verifyAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const plans = getPlans();
        return NextResponse.json({ success: true, data: plans });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        // Solo admin
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json();
        if (!Array.isArray(body)) {
            return NextResponse.json({ error: "Invalid body format, expected array" }, { status: 400 });
        }

        const newPlans = updatePlans(body);

        return NextResponse.json({ success: true, data: newPlans });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
