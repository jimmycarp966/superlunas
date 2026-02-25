import { Lock } from "lucide-react";
import { cookies } from "next/headers";
import { verifyAuth } from "@/lib/auth";

export default async function CotizadorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let isAdmin = false;
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("lunas_confort_session")?.value;
        if (token) {
            const payload = await verifyAuth(token);
            if (payload.role === "admin") isAdmin = true;
        }
    } catch {
        // Middleware handles auth redirects.
    }

    return (
        <div className="flex flex-col min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#183254_0%,#0f1f36_35%,#0a1729_100%)] text-neutral-200">
            <header className="w-full py-3 px-3 sm:px-4 md:px-6 relative z-10">
                <div className="flex flex-wrap justify-end items-center gap-2 sm:gap-3">
                    {isAdmin && (
                        <a
                            href="/config/panel"
                            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-[#101d30] hover:bg-[#1a2a45] text-neutral-200 text-[11px] sm:text-xs font-black tracking-wide rounded border border-[#2a3a57] transition-all uppercase"
                        >
                            Configurar
                        </a>
                    )}
                    <form action="/api/auth/logout" method="POST">
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-[#ef3d2f] hover:bg-[#d8382b] text-white text-[11px] sm:text-xs font-black tracking-wide rounded border border-red-300/25 shadow-lg shadow-red-900/25 transition-all uppercase"
                        >
                            <Lock className="w-4 h-4" />
                            Salir
                        </button>
                    </form>
                </div>

                <div className="flex justify-center -mt-1 mb-2">
                    <div className="text-center">
                        <h1
                            className="text-2xl md:text-3xl font-extrabold text-white tracking-widest uppercase leading-none"
                            style={{ WebkitTextStroke: "1px #f97316" }}
                        >
                            <span className="text-yellow-400 text-4xl md:text-5xl inline-block -mr-1.5">C</span>
                            <span className="text-red-500">L</span>UNA&apos;S
                            <br />
                            <span className="text-red-500">C</span>ONFORT
                        </h1>
                        <p className="text-red-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                            Todo para su hogar y comercio
                        </p>
                        <p className="text-white/85 text-lg md:text-xl font-black mt-1">Cotizador</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center">{children}</main>
        </div>
    );
}
