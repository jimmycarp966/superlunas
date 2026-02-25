import { Registration, ClientRecord } from "./types";
import { supabase } from "./supabase";
import * as xlsx from "xlsx";

declare global {
    var appRegistrations: Registration[] | undefined;
    var clientsCache: ClientRecord[] | undefined;
}

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
};

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
});

export const getRegistrations = async (): Promise<Registration[]> => {
    const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .order("fecha", { ascending: false });

    if (error || !data) return [];

    const regs = (data as Record<string, unknown>[]).map(rowToRegistration);
    global.appRegistrations = regs;
    return regs;
};

export const addOrUpdateClient = async (client: ClientRecord): Promise<void> => {
    const nombre = client.nombre.toUpperCase().trim();
    const normalized: ClientRecord = { ...client, nombre };

    await supabase
        .from("clients")
        .upsert(clientToRow(normalized), { onConflict: "nombre" });

    if (!global.clientsCache) global.clientsCache = [];
    const idx = global.clientsCache.findIndex(c => c.nombre === nombre);
    if (idx >= 0) {
        global.clientsCache = [
            ...global.clientsCache.slice(0, idx),
            { ...global.clientsCache[idx], ...normalized },
            ...global.clientsCache.slice(idx + 1),
        ];
    } else {
        global.clientsCache = [normalized, ...global.clientsCache];
    }
};

export const addRegistration = async (data: Omit<Registration, "id" | "fecha">): Promise<Registration> => {
    const reg: Registration = {
        ...data,
        id: Date.now().toString(),
        fecha: new Date().toISOString(),
    };

    await supabase.from("registrations").insert(registrationToRow(reg));

    if (!global.appRegistrations) global.appRegistrations = [];
    global.appRegistrations = [reg, ...global.appRegistrations];

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
        });
    }

    return reg;
};

export const getClients = async (): Promise<ClientRecord[]> => {
    if (global.clientsCache && global.clientsCache.length > 0) return global.clientsCache;

    const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("nombre", { ascending: true });

    if (error || !data) {
        if (!global.clientsCache) global.clientsCache = [];
        return global.clientsCache;
    }

    global.clientsCache = (data as Record<string, unknown>[]).map(rowToClient);
    return global.clientsCache;
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

    global.clientsCache = clients;
    return clients.length;
};
