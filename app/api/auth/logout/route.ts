import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const response = NextResponse.redirect(new URL("/", request.url));

    response.cookies.delete("lunas_confort_session");

    return response;
}
