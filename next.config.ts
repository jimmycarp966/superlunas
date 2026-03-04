import type { NextConfig } from "next";

const buildTimeIso = new Date().toISOString();

const nextConfig: NextConfig = {
    serverExternalPackages: ["pdf-parse"],
    reactCompiler: true,
    env: {
        NEXT_PUBLIC_BUILD_TIME_ISO: buildTimeIso,
    },
};

export default nextConfig;
