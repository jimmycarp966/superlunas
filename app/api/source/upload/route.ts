import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { getCurrentCatalog } from "@/lib/sourceLoader";

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
            return NextResponse.json({ error: "No se encontró el archivo" }, { status: 400 });
        }

        // Convert file to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Escribimos el archivo en el sistema temporal/local para emular la DB
        // En despliegue Vercel (/tmp es lo unico escribible pero sobrevive un request)
        // Lo pondremos en process.cwd() asumiendo uso local para esta etapa
        const destDir = path.join(process.cwd(), "..", "uploads");
        await fs.mkdir(destDir, { recursive: true });

        // Lo llamamos custom_source
        const isPdf = file.name.toLowerCase().endsWith(".pdf");
        const filename = `custom_source.${isPdf ? "pdf" : "xlsx"}`;
        const filePath = path.join(destDir, filename);

        await fs.writeFile(filePath, buffer);

        // Actualizamos variable de enterno al runtime actual (durara durante este proceso)
        // El loader leera de aqui en el siguiente refresh
        process.env.SOURCE_FILE_URL = filePath;
        process.env.SOURCE_FILE_TYPE = isPdf ? "pdf" : "excel";

        // Forzamos actualizacion del cache global
        const newCatalog = await getCurrentCatalog({ forceRefresh: true });

        return NextResponse.json({ success: true, itemsCount: newCatalog.length, type: isPdf ? 'pdf' : 'excel' });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
