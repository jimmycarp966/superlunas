import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";

let cachedBuildId: string | null = null;
let cachedBuildDeployedAtIso: string | null = null;
let cachedBuildFilePath: string | null = null;

const getBuildId = async (): Promise<{ buildId: string; filePath: string } | null> => {
    if (cachedBuildId && cachedBuildFilePath) {
        return { buildId: cachedBuildId, filePath: cachedBuildFilePath };
    }
    try {
        const filePath = join(process.cwd(), ".next", "BUILD_ID");
        const buildIdRaw = await readFile(filePath, "utf8");
        const buildId = String(buildIdRaw ?? "").trim();
        if (buildId) {
            cachedBuildId = buildId;
            cachedBuildFilePath = filePath;
            return { buildId, filePath };
        }
    } catch {
        // Fallback to env vars.
    }

    return null;
};

const getBuildDeployedAt = async (filePath: string): Promise<string | null> => {
    if (cachedBuildDeployedAtIso) return cachedBuildDeployedAtIso;
    try {
        const info = await stat(filePath);
        const mtime = new Date(info.mtimeMs);
        if (!Number.isNaN(mtime.getTime())) {
            cachedBuildDeployedAtIso = mtime.toISOString();
            return cachedBuildDeployedAtIso;
        }
    } catch {
        // Best effort.
    }
    return null;
};

const getAppVersion = async (): Promise<{ version: string; deployedAt: string | null }> => {
    const build = await getBuildId();
    if (build) {
        const deployedAt = await getBuildDeployedAt(build.filePath);
        return {
            version: build.buildId,
            deployedAt,
        };
    }

    const rawVersion =
        process.env.VERCEL_DEPLOYMENT_ID ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
        process.env.VERCEL_URL ||
        "local-development";

    return {
        version: String(rawVersion).trim() || "local-development",
        deployedAt: null,
    };
};

export async function GET() {
    const { version, deployedAt } = await getAppVersion();

    return NextResponse.json(
        {
            success: true,
            version,
            deployedAt,
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
