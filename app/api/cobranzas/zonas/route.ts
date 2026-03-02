import { NextResponse } from "next/server";
import { ZONAS_COBRANZA_DEFAULT } from "@/lib/cobranzas";
import { NextRequest } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { errorResponse } = await requireSession(request, [
        "admin",
        "gerente",
        "encargado_cobranza",
        "cobrador",
        "cajero",
    ]);
    if (errorResponse) return errorResponse;

    try {
        const { data, error } = await supabase
            .from("zonas_cobranza")
            .select("nombre")
            .order("nombre", { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
            return NextResponse.json({
                success: true,
                data: data.map((row) => String((row as { nombre?: string }).nombre ?? "")),
            });
        }
    } catch {
        // fallback local
    }

    return NextResponse.json({
        success: true,
        data: ZONAS_COBRANZA_DEFAULT,
    });
}
