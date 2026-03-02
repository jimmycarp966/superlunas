import { supabase } from "./supabase";
import { recordAuditEvent } from "./audit";
import { SessionPayload } from "./roles";

interface ParsedProductLine {
    codigo: string;
    cantidad: number;
}

const parseProductosFromText = (text: string): ParsedProductLine[] => {
    const lines = String(text ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const parsed: ParsedProductLine[] = [];
    for (const line of lines) {
        const qtyMatch = line.match(/^(\d+)\s*x\s*/i);
        const codigoMatch = line.match(/\[([A-Za-z0-9-_]+)\]/);
        if (!codigoMatch) continue;
        const cantidad = qtyMatch ? Number(qtyMatch[1]) : 1;
        if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
        parsed.push({
            codigo: String(codigoMatch[1]).trim(),
            cantidad,
        });
    }

    const merged = new Map<string, number>();
    for (const item of parsed) {
        merged.set(item.codigo, (merged.get(item.codigo) ?? 0) + item.cantidad);
    }

    return Array.from(merged.entries()).map(([codigo, cantidad]) => ({ codigo, cantidad }));
};

export const confirmarSalidaStockPorRegistro = async (params: {
    registroId: string;
    productosText: string;
    session?: SessionPayload;
}) => {
    const items = parseProductosFromText(params.productosText);
    if (items.length === 0) return;

    // Gestión de stock en Supabase: se ejecuta solo si el producto existe en la tabla.
    // Si la migración no fue aplicada o el producto no está sincronizado, se omite sin bloquear la nota de pedido.
    for (const item of items) {
        try {
            const { data: productData, error: productError } = await supabase
                .from("products")
                .select("codigo, stock")
                .eq("codigo", item.codigo)
                .single();

            if (productError || !productData) continue;

            const currentStock = Number((productData as { stock?: number }).stock ?? 0);
            if (currentStock < item.cantidad) continue;

            const newStock = currentStock - item.cantidad;
            await supabase
                .from("products")
                .update({ stock: newStock })
                .eq("codigo", item.codigo);

            await supabase.from("stock_movimientos").insert({
                product_codigo: item.codigo,
                sucursal_id: params.session?.sucursalId ?? null,
                tipo: "salida",
                cantidad: item.cantidad,
                referencia: `registro:${params.registroId}`,
                created_by: params.session?.username ?? params.session?.nombre ?? "sistema",
            });

            await supabase.from("stock_reservas").insert({
                product_codigo: item.codigo,
                sucursal_id: params.session?.sucursalId ?? null,
                origen: `registro:${params.registroId}`,
                cantidad: item.cantidad,
                estado: "confirmada",
                expires_at: new Date().toISOString(),
            });
        } catch {
            // Si Supabase no tiene la tabla o el producto, no bloquea la nota de pedido.
        }
    }

    await recordAuditEvent(params.session, {
        action: "stock.salida_por_registro",
        entity: "registrations",
        entityId: params.registroId,
        details: { items },
    });
};

export const crearTransferenciaStockManual = async (params: {
    session: SessionPayload;
    productCodigo: string;
    sucursalOrigenId: string;
    sucursalDestinoId: string;
    cantidad: number;
}) => {
    const cantidad = Number(params.cantidad ?? 0);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error("Cantidad invalida para transferencia.");
    }

    const { data, error } = await supabase
        .from("transferencias_stock")
        .insert({
            product_codigo: params.productCodigo,
            sucursal_origen_id: params.sucursalOrigenId,
            sucursal_destino_id: params.sucursalDestinoId,
            cantidad,
            estado: "pendiente",
            aprobado_por: null,
        })
        .select("*")
        .single();
    if (error || !data) {
        throw new Error(`No se pudo crear transferencia: ${error?.message ?? "sin datos"}`);
    }

    await recordAuditEvent(params.session, {
        action: "stock.transferencia_creada",
        entity: "transferencias_stock",
        entityId: String((data as { id: string }).id),
        details: {
            productCodigo: params.productCodigo,
            sucursalOrigenId: params.sucursalOrigenId,
            sucursalDestinoId: params.sucursalDestinoId,
            cantidad,
        },
    });

    return data;
};

export const aprobarYEnviarTransferenciaStock = async (params: {
    session: SessionPayload;
    transferenciaId: string;
}) => {
    const { data: transferData, error: transferError } = await supabase
        .from("transferencias_stock")
        .select("*")
        .eq("id", params.transferenciaId)
        .single();
    if (transferError || !transferData) {
        throw new Error(`No se encontro transferencia: ${transferError?.message ?? "sin datos"}`);
    }

    const transfer = transferData as {
        id: string;
        product_codigo: string;
        sucursal_origen_id: string;
        sucursal_destino_id: string;
        cantidad: number;
        estado: string;
    };

    if (transfer.estado !== "pendiente" && transfer.estado !== "aprobada") {
        throw new Error("La transferencia no esta disponible para envio.");
    }

    const { data: productData, error: productError } = await supabase
        .from("products")
        .select("stock")
        .eq("codigo", transfer.product_codigo)
        .single();
    if (productError || !productData) {
        throw new Error(`No se encontro producto para transferencia: ${productError?.message ?? "sin datos"}`);
    }

    const currentStock = Number((productData as { stock?: number }).stock ?? 0);
    const qty = Number(transfer.cantidad ?? 0);
    if (currentStock < qty) {
        throw new Error(`Stock insuficiente para transferir ${qty} unidades.`);
    }

    const { error: stockUpdateError } = await supabase
        .from("products")
        .update({ stock: currentStock - qty })
        .eq("codigo", transfer.product_codigo);
    if (stockUpdateError) {
        throw new Error(`No se pudo descontar stock para transferencia: ${stockUpdateError.message}`);
    }

    await supabase.from("stock_movimientos").insert([
        {
            product_codigo: transfer.product_codigo,
            sucursal_id: transfer.sucursal_origen_id,
            tipo: "transferencia",
            cantidad: -Math.abs(qty),
            referencia: `transferencia:${transfer.id}:origen`,
            created_by: params.session.username ?? params.session.nombre ?? "sistema",
        },
        {
            product_codigo: transfer.product_codigo,
            sucursal_id: transfer.sucursal_destino_id,
            tipo: "transferencia",
            cantidad: Math.abs(qty),
            referencia: `transferencia:${transfer.id}:destino`,
            created_by: params.session.username ?? params.session.nombre ?? "sistema",
        },
    ]);

    const { data: updated, error: updateError } = await supabase
        .from("transferencias_stock")
        .update({
            estado: "enviada",
            aprobado_por: params.session.nombre ?? params.session.username ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", transfer.id)
        .select("*")
        .single();
    if (updateError || !updated) {
        throw new Error(`No se pudo actualizar estado de transferencia: ${updateError?.message ?? "sin datos"}`);
    }

    await recordAuditEvent(params.session, {
        action: "stock.transferencia_enviada",
        entity: "transferencias_stock",
        entityId: transfer.id,
        details: {
            productCodigo: transfer.product_codigo,
            cantidad: qty,
            sucursalOrigenId: transfer.sucursal_origen_id,
            sucursalDestinoId: transfer.sucursal_destino_id,
        },
    });

    return updated;
};

