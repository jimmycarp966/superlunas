import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "./auth";
import { AppRole, hasSomeRole, SessionPayload } from "./roles";

export interface ApiAuthResult {
    session: SessionPayload | null;
    errorResponse: NextResponse | null;
}

export const requireSession = async (
    request: NextRequest,
    allowedRoles?: AppRole[],
): Promise<ApiAuthResult> => {
    const token = request.cookies.get("lunas_confort_session")?.value;
    if (!token) {
        return {
            session: null,
            errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }

    try {
        const session = await verifyAuth(token);
        if (allowedRoles && !hasSomeRole(session, allowedRoles)) {
            return {
                session: null,
                errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
        return { session, errorResponse: null };
    } catch {
        return {
            session: null,
            errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        };
    }
};

