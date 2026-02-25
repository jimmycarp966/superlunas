import { Registration, ClientRecord } from "./types";
import { supabase } from "./supabase";
import * as xlsx from "xlsx";

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
};

const normalizeDni = (dni: string): string =>
    String(dni ?? "").replace(/\D/g, "");

export interface LatestClientEntry {
    nombre: string;
    dni: string;
    fecha: string;
    zona: string;
    telefono: string;
    localidad: string;
    hasDuplicateDni: boolean;
    hasTitularConyugueMatch: boolean;
}

export interface ClientsInsights {
    latest10: LatestClientEntry[];
    duplicateDnis: string[];
    titularConyugueDnis: string[];
}

const rowToRegistration = (row: Record<string, unknown>): Registration => ({
    id: String(row.id),
    fecha: String(row.fecha),
    vendedor: String(row.vendedor ?? ""),
    zona: String(row.zona ?? ""),
    cliente: String(row.cliente ?? ""),
    nroCliente: String(row.nro_cliente ?? ""),
    dni: String(row.dni ?? ""),
    telefono: String(row.telefono ?? ""),
    localidad: String(row.localidad ?? ""),
    rubro: String(row.rubro ?? ""),
    domCom: String(row.dom_com ?? ""),
    domPar: String(row.dom_par ?? ""),
    productos: String(row.productos ?? ""),
    planes: String(row.planes ?? ""),
    anticipo: String(row.anticipo ?? ""),
    total: String(row.total ?? ""),
    conyugue: String(row.conyugue ?? ""),
    dniConyugue: String(row.dni_conyugue ?? ""),
    telConyugue: String(row.tel_conyugue ?? ""),
    observaciones: String(row.observaciones ?? ""),
});

const registrationToRow = (r: Registration) => ({
    id: r.id,
    fecha: r.fecha,
    vendedor: r.vendedor,
    zona: r.zona,
    cliente: r.cliente,
    nro_cliente: r.nroCliente,
    dni: r.dni,
    telefono: r.telefono,
    localidad: r.localidad,
    rubro: r.rubro,
    dom_com: r.domCom,
    dom_par: r.domPar,
    productos: r.productos,
    planes: r.planes,
    anticipo: r.anticipo,
    total: r.total,
    conyugue: r.conyugue,
    dni_conyugue: r.dniConyugue,
    tel_conyugue: r.telConyugue,
    observaciones: r.observaciones,
});

const rowToClient = (row: Record<string, unknown>): ClientRecord => ({
    nombre: String(row.nombre),
    dni: String(row.dni ?? ""),
    telefono: String(row.telefono ?? ""),
    localidad: String(row.localidad ?? ""),
    rubro: String(row.rubro ?? ""),
    domCom: String(row.dom_com ?? ""),
    domPar: String(row.dom_par ?? ""),
    conyugue: String(row.conyugue ?? ""),
    dniConyugue: String(row.dni_conyugue ?? ""),
    telConyugue: String(row.tel_conyugue ?? ""),
    zona: String(row.zona ?? ""),
    nroCliente: String(row.nro_cliente ?? ""),
    observaciones: String(row.observaciones ?? ""),
});

const clientToRow = (c: ClientRecord) => ({
    nombre: c.nombre,
    dni: c.dni,
    telefono: c.telefono,
    localidad: c.localidad,
    rubro: c.rubro,
    dom_com: c.domCom,
    dom_par: c.domPar,
    conyugue: c.conyugue,
    dni_conyugue: c.dniConyugue,
    tel_conyugue: c.telConyugue,
    zona: c.zona,
    nro_cliente: c.nroCliente,
    observaciones: c.observaciones ?? "",
});

export const getRegistrations = async (): Promise<Registration[]> => {
    const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .order("fecha", { ascending: false });

    if (error || !data) return [];

    return (data as Record<string, unknown>[]).map(rowToRegistration);
};

export const addOrUpdateClient = async (client: ClientRecord): Promise<void> => {
    const nombre = client.nombre.toUpperCase().trim();
    const normalizedInput: ClientRecord = { ...client, nombre };

    const existingClients = await getClients();
    const targetDni = normalizeDni(normalizedInput.dni);
    const existingByDni = targetDni
        ? existingClients.find(c => normalizeDni(c.dni) === targetDni)
        : undefined;
    const existingByName = existingClients.find(c => c.nombre.toUpperCase().trim() === nombre);
    const existing = existingByDni ?? existingByName;

    const mergedObservaciones = normalizedInput.observaciones?.trim()
        ? normalizedInput.observaciones.trim()
        : (existing?.observaciones ?? "");

    if (existing) {
        const merged: ClientRecord = {
            ...existing,
            ...normalizedInput,
            nombre: existing.nombre,
            observaciones: mergedObservaciones,
        };

        const { error: updateError } = await supabase
            .from("clients")
            .update(clientToRow(merged))
            .eq("nombre", existing.nombre);

        if (updateError) throw new Error(`No se pudo actualizar client: ${updateError.message}`);
        return;
    }

    const toInsert: ClientRecord = {
        ...normalizedInput,
        observaciones: mergedObservaciones,
    };
    const { error: insertError } = await supabase
        .from("clients")
        .upsert(clientToRow(toInsert), { onConflict: "nombre" });
    if (insertError) throw new Error(`No se pudo guardar client: ${insertError.message}`);
};

export const addRegistration = async (data: Omit<Registration, "id" | "fecha">): Promise<Registration> => {
    const reg: Registration = {
        ...data,
        id: Date.now().toString(),
        fecha: new Date().toISOString(),
    };

    await supabase.from("registrations").insert(registrationToRow(reg));

    if (data.cliente) {
        await addOrUpdateClient({
            nombre: data.cliente,
            dni: data.dni,
            telefono: data.telefono,
            localidad: data.localidad,
            rubro: data.rubro,
            domCom: data.domCom,
            domPar: data.domPar,
            conyugue: data.conyugue,
            dniConyugue: data.dniConyugue,
            telConyugue: data.telConyugue,
            zona: data.zona,
            nroCliente: data.nroCliente,
            observaciones: data.observaciones,
        });
    }

    return reg;
};

export const getClients = async (): Promise<ClientRecord[]> => {
    const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("nombre", { ascending: true });

    if (error || !data) {
        return [];
    }

    return (data as Record<string, unknown>[]).map(rowToClient);
};

export const updateClientObservaciones = async (params: {
    nombre?: string;
    dni?: string;
    observaciones: string;
}): Promise<ClientRecord> => {
    const allClients = await getClients();
    const dniNorm = normalizeDni(params.dni || "");
    const nombreNorm = String(params.nombre || "").toUpperCase().trim();

    let target: ClientRecord | undefined;
    if (dniNorm) {
        target = allClients.find(c => normalizeDni(c.dni) === dniNorm);
    }
    if (!target && nombreNorm) {
        target = allClients.find(c => c.nombre.toUpperCase().trim() === nombreNorm);
    }

    if (!target) {
        throw new Error("Cliente no encontrado para actualizar observaciones.");
    }

    const updated: ClientRecord = {
        ...target,
        observaciones: String(params.observaciones ?? "").trim(),
    };

    const { error } = await supabase
        .from("clients")
        .update({ observaciones: updated.observaciones })
        .eq("nombre", target.nombre);

    if (error) {
        throw new Error(`No se pudo actualizar observaciones de client: ${error.message}`);
    }

    return updated;
};

export const getClientsInsights = async (): Promise<ClientsInsights> => {
    const [clients, registrations] = await Promise.all([
        getClients(),
        getRegistrations(),
    ]);

    const countByDni = new Map<string, number>();
    const titularSet = new Set<string>();
    const conyugueSet = new Set<string>();

    const bump = (dniRaw: string) => {
        const dni = normalizeDni(dniRaw);
        if (!dni) return;
        countByDni.set(dni, (countByDni.get(dni) ?? 0) + 1);
    };

    clients.forEach(c => bump(c.dni));
    registrations.forEach(r => {
        bump(r.dni);
        bump(r.dniConyugue);

        const dniTitular = normalizeDni(r.dni);
        if (dniTitular) titularSet.add(dniTitular);

        const dniCony = normalizeDni(r.dniConyugue);
        if (dniCony) conyugueSet.add(dniCony);
    });

    const duplicateDnis = Array.from(countByDni.entries())
        .filter(([, count]) => count > 1)
        .map(([dni]) => dni);

    const duplicateSet = new Set(duplicateDnis);
    const titularConyugueDnis = Array.from(titularSet).filter(dni => conyugueSet.has(dni));
    const titularConyugueSet = new Set(titularConyugueDnis);

    const latest10: LatestClientEntry[] = registrations.slice(0, 10).map(reg => {
        const dniNorm = normalizeDni(reg.dni);
        return {
            nombre: reg.cliente,
            dni: reg.dni,
            fecha: reg.fecha,
            zona: reg.zona,
            telefono: reg.telefono,
            localidad: reg.localidad,
            hasDuplicateDni: dniNorm ? duplicateSet.has(dniNorm) : false,
            hasTitularConyugueMatch: dniNorm ? titularConyugueSet.has(dniNorm) : false,
        };
    });

    return {
        latest10,
        duplicateDnis,
        titularConyugueDnis,
    };
};

export const loadClientsFromBuffer = async (buffer: Buffer): Promise<number> => {
    const wb = xlsx.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];

    const seen = new Set<string>();
    const clients: ClientRecord[] = [];

    rows.forEach(row => {
        const nombre = String(row["CLIENTE"] || row["cliente"] || "").trim().toUpperCase();
        if (!nombre || seen.has(nombre)) return;
        seen.add(nombre);
        clients.push({
            nombre,
            dni: String(row["DNI"] || ""),
            telefono: String(row["TELEFONO"] || ""),
            localidad: String(row["LOCALIDAD"] || ""),
            rubro: String(row["RUBRO"] || ""),
            domCom: String(row["DOM. COM"] || row["DOM COM"] || ""),
            domPar: String(row["DOM. PAR"] || row["DOM PAR"] || ""),
            conyugue: String(row["CONYUGUE"] || ""),
            dniConyugue: String(row["DNI CONYUGUE"] || ""),
            telConyugue: String(row["TEL CONYUGUE"] || ""),
            zona: String(row["ZONA"] || ""),
            nroCliente: String(row["NÂ° CLIENTE"] || row["NÂº CLIENTE"] || ""),
            observaciones: String(row["OBSERVACIONES"] || ""),
        });
    });

    if (clients.length === 0) {
        throw new Error("El archivo de clientes no contiene filas validas; se cancela la actualizacion para evitar borrar clientes.");
    }

    const { data: backupRows, error: backupError } = await supabase
        .from("clients")
        .select("*");

    if (backupError) {
        throw new Error(`No se pudo leer clients antes de actualizar: ${backupError.message}`);
    }

    const { error: deleteError } = await supabase
        .from("clients")
        .delete()
        .neq("nombre", "");

    if (deleteError) {
        throw new Error(`No se pudo limpiar clients antes de actualizar: ${deleteError.message}`);
    }

    const rowsToInsert = clients.map(clientToRow);
    const BATCH = 500;
    try {
        for (let i = 0; i < rowsToInsert.length; i += BATCH) {
            const chunk = rowsToInsert.slice(i, i + BATCH);
            const { error: insertError } = await supabase.from("clients").insert(chunk);
            if (insertError) throw insertError;
        }
    } catch (insertErr) {
        const insertMessage = getErrorMessage(insertErr);

        const { error: clearRollbackError } = await supabase
            .from("clients")
            .delete()
            .neq("nombre", "");

        if (clearRollbackError) {
            throw new Error(`Fallo actualizacion de clients (${insertMessage}) y no se pudo limpiar para rollback: ${clearRollbackError.message}`);
        }

        if (backupRows && backupRows.length > 0) {
            for (let i = 0; i < backupRows.length; i += BATCH) {
                const backupChunk = backupRows.slice(i, i + BATCH);
                const { error: restoreError } = await supabase.from("clients").insert(backupChunk);
                if (restoreError) {
                    throw new Error(`Fallo actualizacion de clients (${insertMessage}) y rollback incompleto: ${restoreError.message}`);
                }
            }
        }

        throw new Error(`Fallo actualizacion de clients en Supabase: ${insertMessage}. Se restauro la lista anterior.`);
    }

    return clients.length;
};
