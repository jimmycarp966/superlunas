import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAuth } from './lib/auth';

export async function middleware(req: NextRequest) {
    // Extraemos token de las cookies
    const token = req.cookies.get('lunas_confort_session')?.value;
    const url = req.nextUrl.clone();

    // Rutas protegidas a revisar
    const isVendorRoute = url.pathname.startsWith('/cotizador');
    const isAdminRoute = url.pathname.startsWith('/config/panel');

    if (isVendorRoute || isAdminRoute) {
        if (!token) {
            url.pathname = isAdminRoute ? '/config' : '/';
            return NextResponse.redirect(url);
        }

        try {
            const payload = await verifyAuth(token);

            // Cheques de autorizacion
            if (isAdminRoute && payload.role !== 'admin') {
                url.pathname = '/';
                return NextResponse.redirect(url);
            }

            // Si todo va bien continuamos
            return NextResponse.next();
        } catch (err) {
            url.pathname = isAdminRoute ? '/config' : '/';
            return NextResponse.redirect(url);
        }
    }

    // Redirigir a usuarios logeados que intentan acceder al login
    if (token && (url.pathname === '/' || url.pathname === '/config')) {
        try {
            const payload = await verifyAuth(token);
            url.pathname = payload.role === 'admin' ? '/config/panel' : '/cotizador';
            return NextResponse.redirect(url);
        } catch (e) {
            // Token expirado o invalido, seguimos normal para que vea el login
        }
    }

    return NextResponse.next();
}

// Configurar el matcher de middleware para no bloquear rutas publicas y assets
export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
