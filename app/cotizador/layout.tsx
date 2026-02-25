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
            if (payload.role === "admin") {
                isAdmin = true;
            }
        }
    } catch {
        // Ignorar, ya lo maneja el middleware
    }

    return (
        <div className="flex flex-col min-h-screen bg-neutral-900 text-neutral-200">
            {/* Header */}
            <header className="w-full flex justify-between items-start py-4 px-6 relative z-10">
                <div className="flex-1"></div>
                <div className="flex-1 flex justify-center">
                    <div className="text-center">
                        <h1 className="text-3xl font-extrabold text-white tracking-widest uppercase" style={{ WebkitTextStroke: '1px #f97316' }}>
                            <span className="text-yellow-400 text-5xl inline-block -mr-2">C</span>
                            <span className="text-red-500">L</span>UNA&apos;S
                            <br />
                            <span className="text-red-500">C</span>ONFORT
                        </h1>
                        <p className="text-red-500 font-bold text-xs uppercase tracking-widest mt-1">15 años juntos</p>
                        <p className="text-red-600 font-bold text-[10px] uppercase tracking-wider">Todo para su hogar y comercio</p>
                    </div>
                </div>
                <div className="flex-1 flex justify-end items-center gap-4">
                    {isAdmin && (
                        <a
                            href="/config/panel"
                            className="flex items-center gap-2 px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-bold tracking-wider rounded border border-neutral-700 transition-all uppercase"
                        >
                            Configurar
                        </a>
                    )}
                    <form action="/api/auth/logout" method="POST">
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold tracking-wider rounded border border-red-500/50 shadow-lg shadow-red-900/20 transition-all uppercase"
                        >
                            <Lock className="w-4 h-4" />
                            SALIR
                        </button>
                    </form>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center">
                {children}
            </main>
        </div>
    );
}
