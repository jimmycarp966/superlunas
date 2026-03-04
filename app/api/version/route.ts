import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

let cachedBuildId: string | null = null;

const getBuildId = async (): Promise<string | null> => {
    if (cachedBuildId) return cachedBuildId;
    try {
        const buildIdRaw = await readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8");
        const buildId = String(buildIdRaw ?? "").trim();
        if (buildId) {
            cachedBuildId = buildId;
            return buildId;
        }
    } catch {
        // Fallback to env vars.
    }

    return null;
};

const getAppVersion = async (): Promise<string> => {
    const buildId = await getBuildId();
    if (buildId) return buildId;

    const rawVersion =
        process.env.VERCEL_DEPLOYMENT_ID ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
        process.env.VERCEL_URL ||
        "local-development";

    return String(rawVersion).trim() || "local-development";
};

export async function GET() {
    const version = await getAppVersion();

    return NextResponse.json(
        {
            success: true,
            version,
        },
        {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                Pragma: "no-cache",
                Expires: "0",
            },
        },
    );
}
