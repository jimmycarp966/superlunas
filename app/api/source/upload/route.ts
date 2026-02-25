import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { loadFromBuffer } from "@/lib/sourceLoader";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const token = request.cookies.get("lunas_confort_session")?.value;
        if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const auth = await verifyAuth(token);
        if (auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ success: false, error: "No se encontró el archivo" }, { status: 400 });
        }

        const isPdf = file.name.toLowerCase().endsWith(".pdf");
        const type = isPdf ? "pdf" : "excel";

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const itemsCount = await loadFromBuffer(buffer, type);

        return NextResponse.json({ success: true, itemsCount, type });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
