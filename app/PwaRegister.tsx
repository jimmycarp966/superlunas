"use client";

import { useEffect } from "react";

export default function PwaRegister() {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

        const register = () => {
            navigator.serviceWorker.register("/sw.js").catch(() => {
                // El registro es best-effort.
            });
        };

        if (document.readyState === "complete") {
            register();
        } else {
            window.addEventListener("load", register);
        }

        return () => window.removeEventListener("load", register);
    }, []);

    return null;
}
