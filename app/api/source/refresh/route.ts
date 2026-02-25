import { NextRequest, NextResponse } from "next/server";
import { getCurrentCatalog } from "@/lib/sourceLoader";
import { verifyAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        // Validamos token admin
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const catalog = await getCurrentCatalog({ forceRefresh: true });

        return NextResponse.json({ success: true, count: catalog.length });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        // Admin only
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const cache = global.catalogCache;
        if (!cache) {
            return NextResponse.json({ success: true, sourceVersion: "none", updatedAt: 0, status: "empty" });
        }

        return NextResponse.json({
            success: true,
            sourceVersion: cache.sourceVersion,
            updatedAt: cache.updatedAt,
            itemsCount: cache.data.length,
            status: "ready"
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
