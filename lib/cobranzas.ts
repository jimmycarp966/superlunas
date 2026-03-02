import { supabase } from "./supabase";
import { recordAuditEvent } from "./audit";
import { SessionPayload, isCorporateRole } from "./roles";
import { CobranzaAgendaItem } from "./types";

interface CobranzaAgendaRow {
    id: string;
    cliente: string;
    dni: string;
    cobrador_username: string;
    zona: string;
    fecha_vencimiento: string;
    monto_pendiente: number;
    cuotas_restantes: number;
    estado: "pendiente" | "pagado" | "vencido";
    sucursal_id: string | null;
}

export const ZONAS_COBRANZA_DEFAULT = [
    "Famailla",
    "Lules",
    "Monteros",
    "Concepcion",
    "Trinidad",
    "Aguilares",
    "Taco Ralo",
    "Alberdi",
    "Los Altos",
    "Los Valles",
    "Mollar/Tafi",
    "Catamarca Sur",
    "Catamarca Norte",
    "Catamarca",
    "Belen",
    "Andagala",
    "Tinogasta",
];

const rowToAgenda = (row: CobranzaAgendaRow): CobranzaAgendaItem => ({
    id: String(row.id),
    cliente: String(row.cliente ?? ""),
    dni: String(row.dni ?? ""),
    cobradorUsername: String(row.cobrador_username ?? ""),
    zona: String(row.zona ?? ""),
    fechaVencimiento: String(row.fecha_vencimiento ?? ""),
    montoPendiente: Number(row.monto_pendiente ?? 0),
    cuotasRestantes: Number(row.cuotas_restantes ?? 0),
    estado: row.estado,
});

const yyyyMmDd = (date: Date): string => {
    return date.toISOString().slice(0, 10);
};

const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
};

const normalizeDateOnly = (dateLike: string | Date): string => {
    const date = typeof dateLike === "string" ? new Date(`${dateLike}T00:00:00`) : dateLike;
    return yyyyMmDd(date);
};

export const buildCobranzaWindow = (baseDate = new Date()): string[] => {
    const start = new Date(baseDate);
    const days: string[] = [];

    // Si arranca viernes/sabado/domingo, va al lunes siguiente.
    const day = start.getDay();
    if (day === 5) start.setDate(start.getDate() + 3);
    if (day === 6) start.setDate(start.getDate() + 2);
    if (day === 0) start.setDate(start.getDate() + 1);

    for (let i = 0; i < 7 && days.length < 4; i++) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        const d = current.getDay();
        if (d >= 1 && d <= 4) {
            days.push(yyyyMmDd(current));
        } else if (d === 5 && days.length > 0) {
            break;
        }
    }

    return days;
};

export const getCobranzaAgenda = async (params: {
    session: SessionPayload;
    fromDate?: string;
    toDate?: string;
}): Promise<CobranzaAgendaItem[]> => {
    const fromDate = params.fromDate ? normalizeDateOnly(params.fromDate) : undefined;
    const toDate = params.toDate ? normalizeDateOnly(params.toDate) : undefined;
    const session = params.session;
    if (!isCorporateRole(session.role) && !session.sucursalId) {
        throw new Error("Usuario sin sucursal asignada.");
    }

    let query = supabase
        .from("cobranzas_agenda")
        .select("*")
        .order("fecha_vencimiento", { ascending: true })
        .order("zona", { ascending: true });

    if (fromDate) query = query.gte("fecha_vencimiento", fromDate);
    if (toDate) query = query.lte("fecha_vencimiento", toDate);

    if (session.role === "cobrador") {
        if (session.username) query = query.eq("cobrador_username", session.username);
        if (session.zona) query = query.eq("zona", session.zona);
    }

    if (session.role === "encargado_cobranza" && session.zona) {
        query = query.eq("zona", session.zona);
    }

    if (!isCorporateRole(session.role) && session.sucursalId) {
        query = query.eq("sucursal_id", session.sucursalId);
    }

    const { data, error } = await query;
    if (error || !data) {
        throw new Error(`No se pudo leer agenda de cobranzas: ${error?.message ?? "sin datos"}`);
    }

    return (data as CobranzaAgendaRow[]).map(rowToAgenda);
};

export const imputarPagoCobranza = async (params: {
    session: SessionPayload;
    agendaId: string;
    monto: number;
    fechaImputacion: string;
    fechaDeudaObjetivo: string;
    medioPago?: string;
    observaciones?: string;
    allowDifference?: boolean;
}): Promise<CobranzaAgendaItem> => {
    const session = params.session;
    const agendaId = String(params.agendaId ?? "").trim();
    const monto = Number(params.monto ?? 0);
    const allowDifference = Boolean(params.allowDifference);
    const fechaImputacion = normalizeDateOnly(params.fechaImputacion || new Date());
    const fechaDeudaObjetivo = normalizeDateOnly(params.fechaDeudaObjetivo || fechaImputacion);
    const imputacionDateObj = new Date(`${fechaImputacion}T00:00:00`);

    if (!agendaId) throw new Error("agendaId invalido");
    if (!Number.isFinite(monto) || monto <= 0) throw new Error("Monto invalido");
    if (isWeekend(imputacionDateObj)) {
        throw new Error("No se permiten imputaciones sabados ni domingos.");
    }
    if (fechaDeudaObjetivo < fechaImputacion) {
        throw new Error("No se permiten pagos retroactivos para fechas anteriores.");
    }

    const { data: rowData, error: rowError } = await supabase
        .from("cobranzas_agenda")
        .select("*")
        .eq("id", agendaId)
        .single();

    if (rowError || !rowData) {
        throw new Error(`No se encontro el item de cobranza: ${rowError?.message ?? "sin datos"}`);
    }

    const row = rowData as CobranzaAgendaRow;
    if (session.role === "cobrador") {
        if (session.username && row.cobrador_username !== session.username) {
            throw new Error("No podes imputar pagos fuera de tu cartera.");
        }
        if (session.zona && row.zona !== session.zona) {
            throw new Error("No podes imputar pagos fuera de tu zona.");
        }
    }

    if (!isCorporateRole(session.role) && session.sucursalId && row.sucursal_id) {
        if (String(row.sucursal_id) !== String(session.sucursalId)) {
            throw new Error("No podes imputar pagos fuera de tu sucursal.");
        }
    }

    const expected = Number(row.monto_pendiente ?? 0);
    if (!allowDifference && Math.abs(monto - expected) > 1) {
        throw new Error(
            `El monto imputado ($${monto}) no coincide con el saldo pendiente ($${expected}).`,
        );
    }

    const nuevoSaldo = Math.max(0, expected - monto);
    const nuevoEstado: CobranzaAgendaRow["estado"] = nuevoSaldo <= 0 ? "pagado" : "pendiente";

    const cuotasRestantes = Math.max(0, Number(row.cuotas_restantes ?? 0) - 1);

    const { data: updatedData, error: updateError } = await supabase
        .from("cobranzas_agenda")
        .update({
            monto_pendiente: nuevoSaldo,
            cuotas_restantes: cuotasRestantes,
            estado: nuevoEstado,
            updated_at: new Date().toISOString(),
        })
        .eq("id", agendaId)
        .select("*")
        .single();

    if (updateError || !updatedData) {
        throw new Error(`No se pudo actualizar la agenda: ${updateError?.message ?? "sin datos"}`);
    }

    const { error: paymentError } = await supabase.from("cobranzas_pagos").insert({
        agenda_id: agendaId,
        cliente: row.cliente,
        dni: row.dni,
        cobrador_username: row.cobrador_username,
        zona: row.zona,
        monto,
        monto_esperado: expected,
        mismatch: Math.abs(monto - expected) > 1,
        fecha_imputacion: fechaImputacion,
        fecha_deuda_objetivo: fechaDeudaObjetivo,
        medio_pago: params.medioPago ?? "efectivo",
        observaciones: params.observaciones ?? null,
        sucursal_id: row.sucursal_id ?? session.sucursalId ?? null,
        created_by: session.username ?? session.nombre ?? null,
    });

    if (paymentError) {
        // rollback best effort del cambio de agenda si el pago no se pudo registrar.
        await supabase
            .from("cobranzas_agenda")
            .update({
                monto_pendiente: expected,
                cuotas_restantes: Number(row.cuotas_restantes ?? 0),
                estado: row.estado,
                updated_at: new Date().toISOString(),
            })
            .eq("id", agendaId);
        throw new Error(`No se pudo guardar el pago: ${paymentError.message}`);
    }

    if (cuotasRestantes > 0 && cuotasRestantes <= 3) {
        await supabase.from("notificaciones").insert({
            tipo: "renovacion",
            titulo: "Cliente con 3 cuotas o menos",
            mensaje: `${row.cliente} (${row.zona}) quedo con ${cuotasRestantes} cuotas.`,
            referencia_id: agendaId,
            canal: "sistema",
        });
    }

    await recordAuditEvent(session, {
        action: "cobranzas.imputacion",
        entity: "cobranzas_agenda",
        entityId: agendaId,
        details: {
            monto,
            montoEsperado: expected,
            nuevoSaldo,
            estado: nuevoEstado,
            fechaImputacion,
            fechaDeudaObjetivo,
        },
    });

    return rowToAgenda(updatedData as CobranzaAgendaRow);
};

export const registrarRendicionCobranza = async (params: {
    session: SessionPayload;
    fecha: string;
    sucursalId?: string | null;
    montoTotal: number;
    destino: "cajero" | "encargado";
    observaciones?: string;
}) => {
    const { session } = params;
    const payload = {
        fecha: normalizeDateOnly(params.fecha),
        username: session.username ?? session.nombre ?? "desconocido",
        zona: session.zona ?? null,
        sucursal_id: params.sucursalId ?? session.sucursalId ?? null,
        monto_total: Number(params.montoTotal) || 0,
        destino: params.destino,
        observaciones: params.observaciones ?? null,
    };

    const { data, error } = await supabase
        .from("cobranzas_rendiciones")
        .insert(payload)
        .select("*")
        .single();

    if (error || !data) {
        throw new Error(`No se pudo registrar la rendicion: ${error?.message ?? "sin datos"}`);
    }

    await recordAuditEvent(session, {
        action: "cobranzas.rendicion",
        entity: "cobranzas_rendiciones",
        entityId: String((data as { id: string }).id),
        details: payload,
    });

    return data;
};
