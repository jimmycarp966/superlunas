import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ codigo: string }> },
) {
    try {
        const { codigo } = await context.params;
        const { data, error } = await supabase
            .from("producto_variantes")
            .select("*")
            .eq("product_codigo", codigo)
            .order("created_at", { ascending: true });
        if (error) throw error;
        return NextResponse.json({ success: true, data: data ?? [] });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ codigo: string }> },
) {
    const { errorResponse } = await requireSession(request, ["admin", "gerente", "cajero"]);
    if (errorResponse) return errorResponse;

    try {
        const { codigo } = await context.params;
        const body = await request.json();
        const payload = {
            product_codigo: codigo,
            color: String(body?.color ?? ""),
            tamano: String(body?.tamano ?? ""),
            modelo: String(body?.modelo ?? ""),
            precio: body?.precio !== undefined ? Number(body.precio) : null,
            stock: body?.stock !== undefined ? Number(body.stock) : null,
        };

        if (!payload.color && !payload.tamano && !payload.modelo) {
            return NextResponse.json(
                { success: false, error: "Defini al menos color, tamano o modelo." },
                { status: 400 },
            );
        }

        const { data, error } = await supabase
            .from("producto_variantes")
            .insert(payload)
            .select("*")
            .single();
        if (error || !data) throw new Error(error?.message ?? "No se pudo agregar variante");
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ codigo: string }> },
) {
    const { errorResponse } = await requireSession(request, ["admin", "gerente", "cajero"]);
    if (errorResponse) return errorResponse;

    try {
        const { codigo } = await context.params;
        const body = await request.json();
        const variantId = String(body?.variantId ?? "").trim();
        if (!variantId) {
            return NextResponse.json({ success: false, error: "variantId requerido." }, { status: 400 });
        }

        const { error } = await supabase
            .from("producto_variantes")
            .delete()
            .eq("id", variantId)
            .eq("product_codigo", codigo);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

