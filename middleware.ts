import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuth } from "./lib/auth";
import { canAccessPath, getDefaultRouteForRole } from "./lib/roles";

const PROTECTED_PREFIXES = [
    "/cotizador",
    "/config/panel",
    "/creditos",
    "/cobranzas",
    "/tesoreria",
    "/reparto",
    "/almacen",
    "/dashboard",
];

const isProtectedPath = (pathname: string): boolean => {
    return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

export async function middleware(req: NextRequest) {
    const token = req.cookies.get("lunas_confort_session")?.value;
    const url = req.nextUrl.clone();
    const pathname = url.pathname;

    if (isProtectedPath(pathname)) {
        if (!token) {
            url.pathname = pathname.startsWith("/config/panel") ? "/config" : "/";
            return NextResponse.redirect(url);
        }

        try {
            const payload = await verifyAuth(token);
            if (!canAccessPath(pathname, payload.role)) {
                url.pathname = getDefaultRouteForRole(payload.role);
                return NextResponse.redirect(url);
            }
            return NextResponse.next();
        } catch {
            url.pathname = pathname.startsWith("/config/panel") ? "/config" : "/";
            return NextResponse.redirect(url);
        }
    }

    if (token && (pathname === "/" || pathname === "/config")) {
        try {
            const payload = await verifyAuth(token);
            url.pathname = getDefaultRouteForRole(payload.role);
            return NextResponse.redirect(url);
        } catch {
            // Token expirado o invalido: se muestra login.
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
