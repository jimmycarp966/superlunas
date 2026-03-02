export const APP_ROLES = [
    "admin",
    "gerente",
    "auditor",
    "encargado_cobranza",
    "vendedor",
    "cobrador",
    "repartidor",
    "cajero",
    "contador",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface SessionPayload {
    role: AppRole;
    userId?: string;
    username?: string;
    nombre?: string;
    sucursalId?: string | null;
    zona?: string | null;
}

const DEFAULT_ROUTE_BY_ROLE: Record<AppRole, string> = {
    admin: "/config/panel",
    gerente: "/config/panel",
    auditor: "/creditos",
    encargado_cobranza: "/cobranzas",
    vendedor: "/cotizador",
    cobrador: "/cobranzas",
    repartidor: "/reparto",
    cajero: "/tesoreria",
    contador: "/tesoreria",
};

const ROUTE_ROLE_RULES: Array<{ prefix: string; roles: AppRole[] }> = [
    {
        prefix: "/cotizador",
        roles: ["admin", "gerente", "vendedor", "cobrador", "encargado_cobranza"],
    },
    {
        prefix: "/config/panel",
        roles: ["admin", "gerente", "contador"],
    },
    {
        prefix: "/creditos",
        roles: ["admin", "gerente", "auditor", "encargado_cobranza", "repartidor", "vendedor"],
    },
    {
        prefix: "/cobranzas",
        roles: ["admin", "gerente", "encargado_cobranza", "cobrador", "cajero"],
    },
    {
        prefix: "/tesoreria",
        roles: ["admin", "gerente", "cajero", "contador"],
    },
    {
        prefix: "/reparto",
        roles: ["admin", "gerente", "repartidor"],
    },
    {
        prefix: "/almacen",
        roles: ["admin", "gerente", "cajero"],
    },
    {
        prefix: "/dashboard",
        roles: ["admin", "gerente", "contador", "encargado_cobranza", "auditor"],
    },
];

export const isAppRole = (value: string): value is AppRole =>
    APP_ROLES.includes(value as AppRole);

export const normalizeRole = (value: string | null | undefined): AppRole | null => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return null;
    return isAppRole(normalized) ? normalized : null;
};

export const hasSomeRole = (
    payload: SessionPayload | null | undefined,
    allowedRoles: AppRole[],
): boolean => {
    if (!payload) return false;
    return allowedRoles.includes(payload.role);
};

export const isCorporateRole = (role: AppRole): boolean => {
    return role === "admin" || role === "gerente" || role === "contador";
};

export const getDefaultRouteForRole = (role: AppRole): string => {
    return DEFAULT_ROUTE_BY_ROLE[role] ?? "/cotizador";
};

export const canAccessPath = (pathname: string, role: AppRole): boolean => {
    const match = ROUTE_ROLE_RULES.find((rule) => pathname.startsWith(rule.prefix));
    if (!match) return true;
    return match.roles.includes(role);
};
