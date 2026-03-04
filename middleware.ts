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
    "/clientes",
    "/nota-de-pedido",
    "/comprobantes-pago",
    "/stock",
    "/reportes",
];

const isProtectedPath = (pathname: string): boolean => {
    return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

const withNoStore = (response: NextResponse): NextResponse => {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
};

export async function middleware(req: NextRequest) {
    const token = req.cookies.get("lunas_confort_session")?.value;
    const url = req.nextUrl.clone();
    const pathname = url.pathname;

    if (pathname === "/comprobantes") {
        url.pathname = "/nota-de-pedido";
        return withNoStore(NextResponse.redirect(url));
    }

    if (pathname === "/recepcion") {
        url.pathname = "/stock";
        return withNoStore(NextResponse.redirect(url));
    }

    if (isProtectedPath(pathname)) {
        if (!token) {
            url.pathname = pathname.startsWith("/config/panel") ? "/config" : "/";
            return withNoStore(NextResponse.redirect(url));
        }

        try {
            const payload = await verifyAuth(token);
            if (!canAccessPath(pathname, payload.role)) {
                url.pathname = getDefaultRouteForRole(payload.role);
                return withNoStore(NextResponse.redirect(url));
            }
            return withNoStore(NextResponse.next());
        } catch {
            url.pathname = pathname.startsWith("/config/panel") ? "/config" : "/";
            return withNoStore(NextResponse.redirect(url));
        }
    }

    if (token && (pathname === "/" || pathname === "/config")) {
        try {
            const payload = await verifyAuth(token);
            url.pathname = getDefaultRouteForRole(payload.role);
            return withNoStore(NextResponse.redirect(url));
        } catch {
            // Token expirado o invalido: se muestra login.
        }
    }

    return withNoStore(NextResponse.next());
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
