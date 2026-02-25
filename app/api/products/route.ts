import { NextRequest, NextResponse } from "next/server";
import { getCurrentCatalog } from "@/lib/sourceLoader";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const list = request.nextUrl.searchParams.get("list");
        const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

        const catalog = await getCurrentCatalog({ forceRefresh });

        let filtered = catalog;
        if (list && list !== 'todos') {
            filtered = catalog.filter((p) => p.lista === list);
        }

        return NextResponse.json({ success: true, data: filtered });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
