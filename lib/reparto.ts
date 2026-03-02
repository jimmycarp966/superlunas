import { supabase } from "./supabase";
import { recordAuditEvent } from "./audit";
import { SessionPayload, isCorporateRole } from "./roles";

export const getRutasSemana = async (session: SessionPayload) => {
    if (!isCorporateRole(session.role) && !session.sucursalId) {
        throw new Error("Usuario sin sucursal asignada.");
    }

    let query = supabase
        .from("reparto_rutas")
        .select("*")
        .order("fecha_programada", { ascending: true });

    if (session.role === "repartidor" && session.username) {
        query = query.eq("repartidor_username", session.username);
    }

    if (!isCorporateRole(session.role) && session.sucursalId) {
        query = query.eq("sucursal_id", session.sucursalId);
    }

    const { data, error } = await query;
    if (error) {
        throw new Error(`No se pudieron leer rutas de reparto: ${error.message}`);
    }
    return data ?? [];
};

export const registrarEntregaReparto = async (params: {
    session: SessionPayload;
    rutaId: string;
    cliente: string;
    direccion: string;
    firmaUrl?: string;
    fotoEntregaUrl?: string;
    checklistCamion?: Record<string, boolean>;
    lat?: number | null;
    lng?: number | null;
}) => {
    const { data: rutaData, error: rutaError } = await supabase
        .from("reparto_rutas")
        .select("id, repartidor_username, sucursal_id, estado")
        .eq("id", params.rutaId)
        .single();
    if (rutaError || !rutaData) {
        throw new Error(`No se encontro la ruta de reparto: ${rutaError?.message ?? "sin datos"}`);
    }

    const ruta = rutaData as {
        id: string;
        repartidor_username: string;
        sucursal_id: string | null;
        estado: string;
    };

    if (params.session.role === "repartidor") {
        if (
            params.session.username &&
            String(ruta.repartidor_username) !== String(params.session.username)
        ) {
            throw new Error("No podes registrar entregas de una ruta ajena.");
        }
    }
    if (params.session.sucursalId && ruta.sucursal_id) {
        if (String(params.session.sucursalId) !== String(ruta.sucursal_id)) {
            throw new Error("No podes registrar entregas fuera de tu sucursal.");
        }
    }

    const payload = {
        ruta_id: params.rutaId,
        repartidor_username: params.session.username ?? params.session.nombre ?? "desconocido",
        cliente: params.cliente,
        direccion: params.direccion,
        firma_url: params.firmaUrl ?? null,
        foto_entrega_url: params.fotoEntregaUrl ?? null,
        checklist_camion: params.checklistCamion ?? {},
        gps_lat: params.lat ?? null,
        gps_lng: params.lng ?? null,
        sucursal_id: params.session.sucursalId ?? null,
    };

    const { data, error } = await supabase
        .from("reparto_entregas")
        .insert(payload)
        .select("*")
        .single();
    if (error || !data) {
        throw new Error(`No se pudo registrar entrega: ${error?.message ?? "sin datos"}`);
    }

    const { error: rutaUpdateError } = await supabase
        .from("reparto_rutas")
        .update({
            estado: "entregado",
            updated_at: new Date().toISOString(),
        })
        .eq("id", params.rutaId);
    if (rutaUpdateError) {
        throw new Error(`Entrega guardada pero no se pudo actualizar ruta: ${rutaUpdateError.message}`);
    }

    await recordAuditEvent(params.session, {
        action: "reparto.entrega",
        entity: "reparto_entregas",
        entityId: String((data as { id: string }).id),
        details: payload,
    });

    return data;
};

export const registrarGpsRepartidor = async (params: {
    session: SessionPayload;
    lat: number;
    lng: number;
    accuracy?: number | null;
}) => {
    const payload = {
        repartidor_username: params.session.username ?? params.session.nombre ?? "desconocido",
        lat: params.lat,
        lng: params.lng,
        accuracy: params.accuracy ?? null,
        sucursal_id: params.session.sucursalId ?? null,
    };

    const { error } = await supabase.from("reparto_gps_logs").insert(payload);
    if (error) {
        throw new Error(`No se pudo registrar GPS: ${error.message}`);
    }
};
