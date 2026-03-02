import { createHash } from "crypto";
import { supabase } from "./supabase";
import { AppRole, normalizeRole, SessionPayload } from "./roles";

interface UserRow {
    id: string;
    username: string;
    nombre: string | null;
    password: string | null;
    role: string;
    sucursal_id: string | null;
    zona: string | null;
    activo: boolean | null;
}

interface AuthUserResult {
    session: SessionPayload;
}

const hashSha256 = (value: string): string => {
    return createHash("sha256").update(value).digest("hex");
};

const matchesPassword = (inputPassword: string, storedPassword: string): boolean => {
    const trimmedStored = storedPassword.trim();
    if (!trimmedStored) return false;

    if (trimmedStored.startsWith("sha256:")) {
        const hash = trimmedStored.slice("sha256:".length).trim().toLowerCase();
        return hashSha256(inputPassword) === hash;
    }

    return inputPassword === trimmedStored;
};

const toSession = (row: UserRow): SessionPayload | null => {
    const role = normalizeRole(row.role);
    if (!role) return null;

    return {
        role,
        userId: String(row.id),
        username: String(row.username),
        nombre: row.nombre ? String(row.nombre) : String(row.username),
        sucursalId: row.sucursal_id ? String(row.sucursal_id) : null,
        zona: row.zona ? String(row.zona) : null,
    };
};

export const authenticateSupabaseUser = async (params: {
    username: string;
    password: string;
    requestedRole?: AppRole | null;
}): Promise<AuthUserResult | null> => {
    const username = String(params.username ?? "").trim().toLowerCase();
    const password = String(params.password ?? "");
    if (!username || !password) return null;

    try {
        const { data, error } = await supabase
            .from("usuarios")
            .select("id, username, nombre, password, role, sucursal_id, zona, activo")
            .eq("username", username)
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;
        const row = data as UserRow;
        if (row.activo === false) return null;
        if (!row.password || !matchesPassword(password, String(row.password))) return null;

        const session = toSession(row);
        if (!session) return null;
        if (params.requestedRole && session.role !== params.requestedRole) return null;

        return { session };
    } catch {
        return null;
    }
};

