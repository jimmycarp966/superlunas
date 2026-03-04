"use client";

import { useEffect, useState } from "react";

const VERSION_SYNC_STORAGE_KEY = "lunas_app_version";
const VERSION_POLL_INTERVAL_MS = 3600000;

type VersionStatus = "checking" | "up_to_date" | "updating";

interface VersionPayload {
    success?: boolean;
    version?: string;
    deployedAt?: string | null;
}

export default function VersionGuard() {
    const [status, setStatus] = useState<VersionStatus>("checking");
    const [displayStamp, setDisplayStamp] = useState("");

    useEffect(() => {
        if (typeof window === "undefined") return;

        let currentVersion: string | null = null;
        let reloadTriggered = false;

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

        const pad2 = (value: number): string => String(value).padStart(2, "0");

        const formatLocalStamp = (rawIso: string | null | undefined): string => {
            const date = new Date(String(rawIso ?? "").trim());
            if (Number.isNaN(date.getTime())) return "";
            const dd = pad2(date.getDate());
            const mm = pad2(date.getMonth() + 1);
            const hh = pad2(date.getHours());
            const min = pad2(date.getMinutes());
            return `${dd}/${mm} ${hh}:${min}`;
        };

        const triggerReload = (nextVersion: string) => {
            if (reloadTriggered) return;
            reloadTriggered = true;
            persistVersion(nextVersion);
            setStatus("updating");
            window.location.reload();
        };

        const markUpToDate = (_version: string, deployedAt: string | null | undefined) => {
            setDisplayStamp(formatLocalStamp(deployedAt));
            setStatus("up_to_date");
        };

        const resolveInitialCurrentVersion = (nextVersion: string): string => {
            // Priorizar SIEMPRE el build local del tab actual.
            const clientBuildId = readClientBuildId();
            if (clientBuildId) return clientBuildId;

            const storedVersion = readStoredVersion();
            if (storedVersion) return storedVersion;

            return nextVersion;
        };

        const reloadIfChanged = (
            nextVersion: string,
            deployedAt: string | null | undefined,
        ) => {
            if (!nextVersion) return;

            if (!currentVersion) {
                currentVersion = resolveInitialCurrentVersion(nextVersion);
            }

            if (nextVersion !== currentVersion) {
                triggerReload(nextVersion);
                return;
            }

            currentVersion = nextVersion;
            persistVersion(nextVersion);
            markUpToDate(nextVersion, deployedAt);
        };

        const checkVersion = async () => {
            try {
                const res = await fetch(`/api/version?_t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;

                const payload = (await res.json()) as VersionPayload;
                const nextVersion = String(payload?.version ?? "").trim();
                const deployedAt = payload?.deployedAt ?? null;
                reloadIfChanged(nextVersion, deployedAt);
            } catch {
                // Best effort.
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== VERSION_SYNC_STORAGE_KEY) return;

            const nextVersion = String(event.newValue ?? "").trim();
            if (!nextVersion) return;

            if (!currentVersion) {
                currentVersion = resolveInitialCurrentVersion(nextVersion);
            }

            if (nextVersion !== currentVersion) {
                triggerReload(nextVersion);
            }
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

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed top-2 left-2 z-40 sm:top-auto sm:bottom-2 sm:left-2"
        >
            {status === "up_to_date" && (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200 shadow-lg backdrop-blur-sm">
                    Ultima version {displayStamp ? `(${displayStamp})` : ""}
                </div>
            )}
            {status === "updating" && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-100 shadow-lg backdrop-blur-sm">
                    Actualizando version...
                </div>
            )}
        </div>
    );
}
