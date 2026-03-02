import { supabase } from "./supabase";
import { SessionPayload } from "./roles";

export interface AuditEventInput {
    action: string;
    entity: string;
    entityId?: string | null;
    details?: Record<string, unknown> | null;
}

export const recordAuditEvent = async (
    session: SessionPayload | null | undefined,
    input: AuditEventInput,
    options?: { strict?: boolean },
): Promise<void> => {
    try {
        await supabase.from("auditoria_acciones").insert({
            user_id: session?.userId ?? null,
            username: session?.username ?? null,
            role: session?.role ?? null,
            sucursal_id: session?.sucursalId ?? null,
            action: input.action,
            entity: input.entity,
            entity_id: input.entityId ?? null,
            details: input.details ?? {},
            created_at: new Date().toISOString(),
        });
    } catch (error) {
        if (options?.strict) {
            const message = error instanceof Error ? error.message : "Error de auditoria";
            throw new Error(message);
        }
    }
};
