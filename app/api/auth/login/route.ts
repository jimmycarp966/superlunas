import { NextRequest, NextResponse } from "next/server";
import { createToken } from "@/lib/auth";
import { AppRole, getDefaultRouteForRole, normalizeRole } from "@/lib/roles";
import { authenticateSupabaseUser } from "@/lib/users";
import { recordAuditEvent } from "@/lib/audit";

const normalizeRequestedRole = (value: unknown): AppRole | null => {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return null;
    if (raw === "vendor") return "vendedor";
    if (raw === "admin") return "admin";
    return normalizeRole(raw);
};

export async function POST(request: NextRequest) {
    try {
        const { username: usernameInput, password, role } = await request.json();
        const username = String(usernameInput ?? "").trim().toLowerCase();
        const requestedRole = normalizeRequestedRole(role);

        if (!username || !password) {
            return NextResponse.json(
                { error: "Faltan credenciales" },
                { status: 400 }
            );
        }

        const authFromSupabase = username
            ? await authenticateSupabaseUser({
                username,
                password: String(password),
                requestedRole,
            })
            : null;

        const session = authFromSupabase?.session ?? null;

        if (!session) {
            await recordAuditEvent(null, {
                action: "auth.login_failed",
                entity: "usuarios",
                entityId: username,
                details: { username, requestedRole: requestedRole ?? null },
            }, { strict: true });
            return NextResponse.json(
                { error: "Contrasena incorrecta" },
                { status: 401 }
            );
        }

        const token = await createToken(session);

        const response = NextResponse.json({
            success: true,
            role: session.role,
            redirectTo: getDefaultRouteForRole(session.role),
        });

        response.cookies.set({
            name: "lunas_confort_session",
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 8,
            path: "/",
        });

        await recordAuditEvent(session, {
            action: "auth.login_success",
            entity: "usuarios",
            entityId: session.userId ?? session.username ?? null,
            details: {
                role: session.role,
                username: session.username ?? null,
                sucursalId: session.sucursalId ?? null,
            },
        }, { strict: true });

        return response;
    } catch {
        return NextResponse.json(
            { error: "Error en el servidor de autenticacion" },
            { status: 500 }
        );
    }
}
