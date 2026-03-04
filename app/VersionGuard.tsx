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

        const readClientBuildId = (): string => {
            const buildId = String(
                (window as unknown as { __NEXT_DATA__?: { buildId?: string } }).__NEXT_DATA__?.buildId ?? "",
            ).trim();
            return buildId;
        };

        const readStoredVersion = (): string => {
            try {
                return String(localStorage.getItem(VERSION_SYNC_STORAGE_KEY) ?? "").trim();
            } catch {
                return "";
            }
        };

        const persistVersion = (version: string) => {
            try {
                localStorage.setItem(VERSION_SYNC_STORAGE_KEY, version);
            } catch {
                // Best effort.
            }
        };

        const reloadIfChanged = (nextVersion: string) => {
            if (!nextVersion) return;

            if (!currentVersion) {
                const storedVersion = readStoredVersion();
                const clientBuildId = readClientBuildId();
                currentVersion = storedVersion || clientBuildId || nextVersion;
            }

            if (nextVersion !== currentVersion) {
                persistVersion(nextVersion);
                window.location.reload();
                return;
            }

            persistVersion(nextVersion);
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

        const handleOnline = () => {
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
        window.addEventListener("online", handleOnline);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("online", handleOnline);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, []);

    return null;
}
