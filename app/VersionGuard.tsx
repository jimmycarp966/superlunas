"use client";

import { useEffect } from "react";

const VERSION_SYNC_STORAGE_KEY = "lunas_app_version";
const VERSION_POLL_INTERVAL_MS = 45000;

interface VersionPayload {
    success?: boolean;
    version?: string;
}

export default function VersionGuard() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        let currentVersion: string | null = null;

        const reloadIfChanged = (nextVersion: string) => {
            if (!nextVersion) return;

            if (!currentVersion) {
                currentVersion = nextVersion;
                return;
            }

            if (nextVersion === currentVersion) return;

            try {
                localStorage.setItem(VERSION_SYNC_STORAGE_KEY, nextVersion);
            } catch {
                // Best effort.
            }

            window.location.reload();
        };

        const checkVersion = async () => {
            try {
                const res = await fetch(`/api/version?_t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;

                const payload = (await res.json()) as VersionPayload;
                const nextVersion = String(payload?.version ?? "").trim();
                reloadIfChanged(nextVersion);
            } catch {
                // Best effort.
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== VERSION_SYNC_STORAGE_KEY) return;
            if (!event.newValue || !currentVersion) return;
            if (event.newValue === currentVersion) return;
            window.location.reload();
        };

        const handleFocus = () => {
            void checkVersion();
        };

        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                void checkVersion();
            }
        };

        void checkVersion();

        const intervalId = window.setInterval(() => {
            void checkVersion();
        }, VERSION_POLL_INTERVAL_MS);

        window.addEventListener("storage", handleStorage);
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, []);

    return null;
}
