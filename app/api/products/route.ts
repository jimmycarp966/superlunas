import { NextRequest, NextResponse } from "next/server";
import { getCurrentCatalog } from "@/lib/sourceLoader";
import { getSettings } from "@/lib/settings";
import { requireSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const list = request.nextUrl.searchParams.get("list");
        const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
        const listKey = (list || "local").trim().toLowerCase();
        const needsMarkup = listKey && listKey !== "local" && listKey !== "todos";

        if (forceRefresh) {
            const { errorResponse } = await requireSession(request, ["admin", "gerente"]);
            if (errorResponse) return errorResponse;
        }

        const catalog = await getCurrentCatalog({ forceRefresh });

        let markup = 0;
        if (needsMarkup) {
            try {
                const settings = await getSettings();
                const normalizedMarkups = Object.fromEntries(
                    Object.entries(settings.listaMarkups ?? {}).map(([k, v]) => [
                        String(k).trim().toLowerCase(),
                        Number(v) || 0,
                    ])
                );
                markup = normalizedMarkups[listKey] ?? 0;
            } catch (settingsError) {
                console.error("No se pudieron cargar markups de listas, se usa 0%:", settingsError);
            }
        }

        const data = markup > 0
            ? catalog.map(p => ({ ...p, precio: Math.round(p.precio * (1 + markup / 100)) }))
            : catalog;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    const { errorResponse } = await requireSession(request, ["admin", "gerente", "cajero"]);
    if (errorResponse) return errorResponse;

    try {
        const body = await request.json();
        const codigo = String(body?.codigo ?? "").trim();
        if (!codigo) {
            return NextResponse.json({ success: false, error: "Codigo requerido." }, { status: 400 });
        }

        const payload = {
            nombre: body?.nombre ? String(body.nombre) : undefined,
            precio: body?.precio !== undefined ? Number(body.precio) : undefined,
            stock: body?.stock !== undefined ? Number(body.stock) : undefined,
            color: body?.color !== undefined ? String(body.color) : undefined,
            tamano: body?.tamano !== undefined ? String(body.tamano) : undefined,
            modelo: body?.modelo !== undefined ? String(body.modelo) : undefined,
            garantia_meses: body?.garantiaMeses !== undefined ? Number(body.garantiaMeses) : undefined,
            requiere_serie: body?.requiereSerie !== undefined ? Boolean(body.requiereSerie) : undefined,
            numero_serie: body?.numeroSerie !== undefined ? String(body.numeroSerie) : undefined,
            imagen_url: body?.imagenUrl !== undefined ? String(body.imagenUrl) : undefined,
        };

        const sanitizedPayload = Object.fromEntries(
            Object.entries(payload).filter(([, value]) => value !== undefined),
        );

        const { data, error } = await supabase
            .from("products")
            .update(sanitizedPayload)
            .eq("codigo", codigo)
            .select("*")
            .single();

        if (error || !data) {
            throw new Error(error?.message ?? "No se pudo actualizar producto");
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
