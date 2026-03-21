const normalize = (value: string | null | undefined): string => {
    return String(value ?? "").trim();
};

export const getCurrentDeploymentVersion = async (): Promise<string> => {
    const fallback = normalize(
        process.env.NEXT_PUBLIC_BUILD_TIME_ISO ||
            process.env.VERCEL_DEPLOYMENT_ID ||
            process.env.VERCEL_GIT_COMMIT_SHA ||
            process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
            "local-development",
    );

    return fallback || "local-development";
};
