"use client";

import { useEffect } from "react";

export default function PwaRegister() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        const RESET_KEY = "lunas_sw_cleanup_done";

        const cleanupLegacyServiceWorker = async () => {
            let changed = false;

            if ("serviceWorker" in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        const unregistered = await registration.unregister();
                        if (unregistered) changed = true;
                    }
                } catch {
                    // Best effort.
                }
            }

            if ("caches" in window) {
                try {
                    const keys = await caches.keys();
                    for (const key of keys) {
                        if (key.startsWith("lunas-shell-") || key.includes("workbox")) {
                            const deleted = await caches.delete(key);
                            if (deleted) changed = true;
                        }
                    }
                } catch {
                    // Best effort.
                }
            }

            if (!changed) return;
            if (sessionStorage.getItem(RESET_KEY) === "1") return;

            sessionStorage.setItem(RESET_KEY, "1");
            window.location.reload();
        };

        void cleanupLegacyServiceWorker();
    }, []);

    return null;
}
