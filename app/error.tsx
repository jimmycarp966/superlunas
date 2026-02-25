"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";

export default function ErrorBoundaryFallback({ error, resetErrorBoundary }: any) {
    return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-neutral-900 border border-neutral-800 rounded-3xl m-4">
            <div className="text-center max-w-md">
                <div className="inline-flex py-3 px-4 rounded-2xl bg-red-500/10 text-red-400 mb-6 border border-red-500/20">
                    <AlertCircle className="w-8 h-8 mr-3" />
                    <h2 className="text-xl font-bold align-middle">Ocurrió un error en la aplicación</h2>
                </div>
                <p className="text-neutral-400 mb-8 font-mono text-sm break-words bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                    {error.message}
                </p>
                <button
                    onClick={resetErrorBoundary}
                    className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
                >
                    Intentar de nuevo
                </button>
            </div>
        </div>
    );
}
