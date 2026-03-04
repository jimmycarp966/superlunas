import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const getAppVersion = (): string => {
    const rawVersion =
        process.env.VERCEL_DEPLOYMENT_ID ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
        process.env.VERCEL_URL ||
        "local-development";

    return String(rawVersion);
};

export async function GET() {
    return NextResponse.json(
        {
            success: true,
            version: getAppVersion(),
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
