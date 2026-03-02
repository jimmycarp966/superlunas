import { NextRequest, NextResponse } from "next/server";
import { createToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const { password, role } = await request.json();

        if (!password || !role) {
            return NextResponse.json(
                { error: "Faltan credenciales" },
                { status: 400 }
            );
        }

        let isValid = false;

        if (role === "vendor") {
            isValid = password === process.env.VENDOR_PASSWORD;
        } else if (role === "admin") {
            isValid = password === process.env.ADMIN_PASSWORD;
        }

        if (!isValid) {
            return NextResponse.json(
                { error: "Contraseña incorrecta" },
                { status: 401 }
            );
        }

        const token = await createToken({ role });

        const response = NextResponse.json({ success: true, role });

        response.cookies.set({
            name: "lunas_confort_session",
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 2, // 2 horas
            path: "/",
        });

        return response;
    } catch (error) {
        return NextResponse.json(
            { error: "Error en el servidor de autenticacion" },
            { status: 500 }
        );
    }
}
