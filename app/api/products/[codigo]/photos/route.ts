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
            .from("producto_fotos")
            .select("*")
            .eq("product_codigo", codigo)
            .order("orden", { ascending: true });
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
        const url = String(body?.url ?? "").trim();
        if (!url) {
            return NextResponse.json({ success: false, error: "URL requerida." }, { status: 400 });
        }
        const isPrimary = Boolean(body?.isPrimary);

        if (isPrimary) {
            await supabase
                .from("producto_fotos")
                .update({ is_primary: false })
                .eq("product_codigo", codigo);
        }

        const { data, error } = await supabase
            .from("producto_fotos")
            .insert({
                product_codigo: codigo,
                url,
                is_primary: isPrimary,
                orden: Number(body?.orden ?? 0),
            })
            .select("*")
            .single();
        if (error || !data) throw new Error(error?.message ?? "No se pudo agregar foto");

        if (isPrimary) {
            await supabase
                .from("products")
                .update({ imagen_url: url })
                .eq("codigo", codigo);
        }

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
        const photoId = String(body?.photoId ?? "").trim();
        if (!photoId) {
            return NextResponse.json({ success: false, error: "photoId requerido." }, { status: 400 });
        }
        const { error } = await supabase
            .from("producto_fotos")
            .delete()
            .eq("id", photoId)
            .eq("product_codigo", codigo);
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

