import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cachedBuildId: string | null = null;

const normalize = (value: string | null | undefined): string => {
    return String(value ?? "").trim();
};

const getBuildIdFromFile = async (): Promise<string | null> => {
    if (cachedBuildId) {
        return cachedBuildId;
    }

    try {
        const filePath = join(process.cwd(), ".next", "BUILD_ID");
        const buildIdRaw = await readFile(filePath, "utf8");
        const buildId = normalize(buildIdRaw);
        if (buildId) {
            cachedBuildId = buildId;
            return buildId;
        }
    } catch {
        // Best effort: fallback to env vars below.
    }

    return null;
};

export const getCurrentDeploymentVersion = async (): Promise<string> => {
    const buildId = await getBuildIdFromFile();
    if (buildId) {
        return buildId;
    }

    const fallback = normalize(
        process.env.VERCEL_DEPLOYMENT_ID ||
            process.env.VERCEL_GIT_COMMIT_SHA ||
            process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
            process.env.NEXT_PUBLIC_BUILD_TIME_ISO ||
            "local-development",
    );

    return fallback || "local-development";
};
