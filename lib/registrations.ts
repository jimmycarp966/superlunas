import { Registration, ClientRecord } from "./types";
import * as xlsx from "xlsx";

declare global {
    var appRegistrations: Registration[] | undefined;
    var clientsCache: ClientRecord[] | undefined;
}

export const getRegistrations = (): Registration[] => {
    if (!global.appRegistrations) global.appRegistrations = [];
    return global.appRegistrations;
};

export const addRegistration = (data: Omit<Registration, "id" | "fecha">): Registration => {
    const reg: Registration = {
        ...data,
        id: Date.now().toString(),
        fecha: new Date().toISOString(),
    };
    if (!global.appRegistrations) global.appRegistrations = [];
    global.appRegistrations = [reg, ...global.appRegistrations];
    return reg;
};

export const getClients = (): ClientRecord[] => {
    if (!global.clientsCache) global.clientsCache = [];
    return global.clientsCache;
};

export const loadClientsFromBuffer = (buffer: Buffer): number => {
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
            conyugue: String(row["CONYUGUE"] || ""),
            dniConyugue: String(row["DNI CONYUGUE"] || ""),
            telConyugue: String(row["TEL CONYUGUE"] || ""),
            zona: String(row["ZONA"] || ""),
            nroCliente: String(row["N° CLIENTE"] || row["Nº CLIENTE"] || ""),
        });
    });

    global.clientsCache = clients;
    return clients.length;
};
