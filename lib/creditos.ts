import { supabase } from "./supabase";
import { recordAuditEvent } from "./audit";
import { CreditoEstado, CreditoSolicitud } from "./types";
import { AppRole, SessionPayload } from "./roles";

interface CreditoRow {
    id: string;
    cliente: string;
    dni: string;
    vendedor: string;
    zona: string;
    total: number;
    estado: CreditoEstado;
    informe_comercial_url: string | null;
    observaciones: string | null;
    sucursal_id: string | null;
    created_at: string;
    updated_at: string;
}

const rowToCredito = (row: CreditoRow): CreditoSolicitud => ({
    id: String(row.id),
    cliente: String(row.cliente ?? ""),
    dni: String(row.dni ?? ""),
    vendedor: String(row.vendedor ?? ""),
    zona: String(row.zona ?? ""),
    total: Number(row.total ?? 0),
    estado: row.estado,
    informeComercialUrl: row.informe_comercial_url,
    observaciones: row.observaciones,
    creadoAt: String(row.created_at),
    actualizadoAt: String(row.updated_at),
});

const canOperateStage = (role: AppRole, estado: CreditoEstado): boolean => {
    if (role === "admin" || role === "gerente") return true;
    if (estado === "pendiente_auditoria") return role === "auditor";
    if (estado === "pendiente_encargado") return role === "encargado_cobranza";
    if (estado === "pendiente_repartidor") return role === "repartidor";
    return false;
};

const nextStateForApproval = (estado: CreditoEstado): CreditoEstado => {
    if (estado === "pendiente_auditoria") return "pendiente_encargado";
    if (estado === "pendiente_encargado") return "pendiente_repartidor";
    if (estado === "pendiente_repartidor") return "aprobado";
    return estado;
};

export const parseAmountLoose = (raw: string | number | null | undefined): number => {
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
    const text = String(raw ?? "").replace(/[^\d.,-]/g, "");
    if (!text) return 0;
    if (text.includes(",") && text.includes(".")) {
        return Number(text.replace(/\./g, "").replace(",", ".")) || 0;
    }
    if (text.includes(",")) {
        const normalized = text.replace(/\./g, "").replace(",", ".");
        return Number(normalized) || 0;
    }
    return Number(text.replace(/,/g, "")) || 0;
};

export const getCreditosSolicitudes = async (
    session: SessionPayload,
): Promise<CreditoSolicitud[]> => {
    let query = supabase
        .from("creditos_solicitudes")
        .select("*")
        .order("created_at", { ascending: false });

    if (session.role === "vendedor" || session.role === "cobrador") {
        query = query.eq("vendedor", session.nombre ?? session.username ?? "");
    }

    const { data, error } = await query;
    if (error || !data) {
        throw new Error(`No se pudieron leer creditos: ${error?.message ?? "sin datos"}`);
    }

    return (data as CreditoRow[]).map(rowToCredito);
};

export const crearCreditoSolicitud = async (
    session: SessionPayload,
    input: {
        cliente: string;
        dni: string;
        vendedor: string;
        zona: string;
        total: number;
        informeComercialUrl?: string | null;
        observaciones?: string | null;
    },
): Promise<CreditoSolicitud> => {
    const payload = {
        cliente: input.cliente,
        dni: input.dni,
        vendedor: input.vendedor,
        zona: input.zona,
        total: Number(input.total) || 0,
        estado: "pendiente_auditoria" as CreditoEstado,
        informe_comercial_url: input.informeComercialUrl ?? null,
        observaciones: input.observaciones ?? null,
        sucursal_id: session.sucursalId ?? null,
    };

    const { data, error } = await supabase
        .from("creditos_solicitudes")
        .insert(payload)
        .select("*")
        .single();

    if (error || !data) {
        throw new Error(`No se pudo crear la solicitud de credito: ${error?.message ?? "sin datos"}`);
    }

    await supabase.from("creditos_historial").insert({
        credito_id: data.id,
        etapa: "pendiente_auditoria",
        accion: "creado",
        usuario: session.nombre ?? session.username ?? "sistema",
        role: session.role,
        comentario: input.observaciones ?? null,
    });

    await recordAuditEvent(session, {
        action: "credito.creado",
        entity: "creditos_solicitudes",
        entityId: String(data.id),
        details: payload,
    });

    return rowToCredito(data as CreditoRow);
};

export const resolverCreditoSolicitud = async (
    session: SessionPayload,
    input: {
        creditoId: string;
        approve: boolean;
        comentario?: string;
        informeComercialUrl?: string | null;
    },
): Promise<CreditoSolicitud> => {
    const creditoId = String(input.creditoId ?? "").trim();
    if (!creditoId) throw new Error("creditoId invalido");

    const { data: currentData, error: currentError } = await supabase
        .from("creditos_solicitudes")
        .select("*")
        .eq("id", creditoId)
        .single();

    if (currentError || !currentData) {
        throw new Error(`No se encontro la solicitud de credito: ${currentError?.message ?? "sin datos"}`);
    }

    const current = currentData as CreditoRow;
    if (!canOperateStage(session.role, current.estado)) {
        throw new Error("No tenes permisos para operar esta etapa del credito.");
    }
    if (current.estado === "aprobado" || current.estado === "rechazado") {
        throw new Error("La solicitud ya fue cerrada.");
    }

    const nextEstado = input.approve ? nextStateForApproval(current.estado) : "rechazado";
    const updatePayload = {
        estado: nextEstado,
        informe_comercial_url: input.informeComercialUrl ?? current.informe_comercial_url,
        observaciones: input.comentario ? String(input.comentario) : current.observaciones,
        updated_at: new Date().toISOString(),
    };

    const { data: updatedData, error: updateError } = await supabase
        .from("creditos_solicitudes")
        .update(updatePayload)
        .eq("id", creditoId)
        .select("*")
        .single();

    if (updateError || !updatedData) {
        throw new Error(`No se pudo actualizar la solicitud de credito: ${updateError?.message ?? "sin datos"}`);
    }

    await supabase.from("creditos_historial").insert({
        credito_id: creditoId,
        etapa: current.estado,
        accion: input.approve ? "aprobado" : "rechazado",
        usuario: session.nombre ?? session.username ?? "sistema",
        role: session.role,
        comentario: input.comentario ?? null,
    });

    await recordAuditEvent(session, {
        action: input.approve ? "credito.aprobado" : "credito.rechazado",
        entity: "creditos_solicitudes",
        entityId: creditoId,
        details: { from: current.estado, to: nextEstado, comentario: input.comentario ?? null },
    });

    return rowToCredito(updatedData as CreditoRow);
};

