import { NextRequest, NextResponse } from "next/server";
import { getCurrentCatalog } from "@/lib/sourceLoader";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const list = request.nextUrl.searchParams.get("list");
        const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

        const [catalog, settings] = await Promise.all([
            getCurrentCatalog({ forceRefresh }),
            getSettings(),
        ]);

        // Todos los productos se almacenan como "local".
        // Para otras listas se aplica el recargo configurado.
        const markup = list && list !== "local" && list !== "todos"
            ? (settings.listaMarkups?.[list] ?? 0)
            : 0;

        const data = markup > 0
            ? catalog.map(p => ({ ...p, precio: Math.round(p.precio * (1 + markup / 100)) }))
            : catalog;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
