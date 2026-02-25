import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getClients, loadClientsFromBuffer, updateClientObservaciones } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        await verifyAuth(token);
        return NextResponse.json({ success: true, data: await getClients() });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ success: false, error: "No file" }, { status: 400 });
        const buffer = Buffer.from(await file.arrayBuffer());
        const count = await loadClientsFromBuffer(buffer);
        return NextResponse.json({ success: true, count });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const nombre = String(body?.nombre ?? "");
        const dni = String(body?.dni ?? "");
        const observaciones = String(body?.observaciones ?? "");

        if (!nombre.trim() && !dni.trim()) {
            return NextResponse.json({ success: false, error: "Se requiere nombre o DNI" }, { status: 400 });
        }

        const updated = await updateClientObservaciones({ nombre, dni, observaciones });
        return NextResponse.json({ success: true, data: updated });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
