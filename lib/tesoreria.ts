import { supabase } from "./supabase";
import { recordAuditEvent } from "./audit";
import { SessionPayload } from "./roles";

const normalizeDateOnly = (value: string): string => {
    return new Date(`${value}T00:00:00`).toISOString().slice(0, 10);
};

const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6;
};

export const validarImputacionTesoreria = (params: {
    fechaImputacion: string;
    fechaDeudaObjetivo: string;
    monto: number;
    montoEsperado: number;
    allowDifference?: boolean;
    allowOverpay?: boolean;
}) => {
    const fechaImputacion = normalizeDateOnly(params.fechaImputacion);
    const fechaDeudaObjetivo = normalizeDateOnly(params.fechaDeudaObjetivo);
    const monto = Number(params.monto ?? 0);
    const montoEsperado = Number(params.montoEsperado ?? 0);
    const allowDifference = Boolean(params.allowDifference);
    const allowOverpay = Boolean(params.allowOverpay);

    if (!Number.isFinite(monto) || monto <= 0) {
        throw new Error("Monto invalido.");
    }

    const dateObj = new Date(`${fechaImputacion}T00:00:00`);
    if (isWeekend(dateObj)) {
        throw new Error("Moratoria activa: sabados y domingos no se pueden imputar pagos.");
    }

    if (fechaDeudaObjetivo < fechaImputacion) {
        throw new Error("No se pueden imputar pagos para atras (fecha de deuda anterior al dia actual).");
    }

    if (!allowDifference && Math.abs(monto - montoEsperado) > 1) {
        throw new Error(
            `El monto imputado ($${monto}) no coincide con la deuda actual ($${montoEsperado}).`,
        );
    }

    if (!allowOverpay && monto > montoEsperado) {
        throw new Error(
            `El monto imputado supera la deuda: pago ${monto} vs deuda ${montoEsperado}.`,
        );
    }

    return {
        fechaImputacion,
        fechaDeudaObjetivo,
    };
};

export const registrarPagoTesoreria = async (params: {
    session: SessionPayload;
    cliente: string;
    dni: string;
    monto: number;
    montoEsperado: number;
    fechaImputacion: string;
    fechaDeudaObjetivo: string;
    medioPago: "efectivo" | "transferencia" | "debito" | "credito" | "otro";
    observaciones?: string;
    sucursalId?: string | null;
    allowDifference?: boolean;
    allowOverpay?: boolean;
}) => {
    const normalized = validarImputacionTesoreria({
        fechaImputacion: params.fechaImputacion,
        fechaDeudaObjetivo: params.fechaDeudaObjetivo,
        monto: params.monto,
        montoEsperado: params.montoEsperado,
        allowDifference: params.allowDifference,
        allowOverpay: params.allowOverpay,
    });

    const conciliado = Math.abs(Number(params.monto) - Number(params.montoEsperado)) <= 1;
    const payload = {
        cliente: params.cliente,
        dni: params.dni,
        monto: Number(params.monto),
        monto_esperado: Number(params.montoEsperado),
        fecha_imputacion: normalized.fechaImputacion,
        fecha_deuda_objetivo: normalized.fechaDeudaObjetivo,
        medio_pago: params.medioPago,
        sucursal_id: params.sucursalId ?? params.session.sucursalId ?? null,
        registrado_por: params.session.username ?? params.session.nombre ?? null,
        conciliado,
        observaciones: params.observaciones ?? null,
    };

    const { data, error } = await supabase
        .from("tesoreria_pagos")
        .insert(payload)
        .select("*")
        .single();

    if (error || !data) {
        throw new Error(`No se pudo registrar pago de tesoreria: ${error?.message ?? "sin datos"}`);
    }

    await recordAuditEvent(params.session, {
        action: "tesoreria.pago",
        entity: "tesoreria_pagos",
        entityId: String((data as { id: string }).id),
        details: payload,
    });

    return data;
};

