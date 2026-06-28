"use client";

import { useEffect } from "react";

const STORAGE_KEY = "ff:buildId";
const DASHBOARD_CACHE_PREFIXES = ["ff_matches_", "ff_teams_"] as const;

function clearStaleDashboardCaches() {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (DASHBOARD_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access issues and still allow the reload path below.
  }
}

/**
 * Compares the client's cached build id with the live one from /api/build.
 * If they differ, the user is running stale JS — force a reload to pull the
 * latest bundle. Without this, mobile browsers (especially iOS Safari with
 * bfcache) can keep serving the previous deploy's UI even after Vercel
 * has published a new build.
 *
 * Mount this once at the top of the authed-user app (e.g. dashboard layout).
 *
 * Idempotent: subsequent visits with a matching build id are a single
 * lightweight fetch (~50 bytes) and no reload. Visits without a stored id
 * (first ever or after a wipe) silently record the current id.
 */
export function useBuildSync(currentBuildId: string) {
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/build", {
          cache: "no-store",
          credentials: "omit",
        });
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as { buildId?: string };
        const live = typeof payload.buildId === "string" ? payload.buildId : "";
        if (!live) return;
        const current = currentBuildId.trim();
        const stored = window.localStorage.getItem(STORAGE_KEY);

        // If the JS bundle running in the browser is not the live build,
        // force a hard reload even if localStorage has already been updated.
        if (current && current !== live) {
          clearStaleDashboardCaches();
          window.localStorage.setItem(STORAGE_KEY, live);
          window.location.reload();
          return;
        }

        if (stored !== live) {
          clearStaleDashboardCaches();
          window.localStorage.setItem(STORAGE_KEY, live);
          if (stored) {
            // Reload from the server, not from the bfcache.
            window.location.reload();
            return;
          }
        }
      } catch {
        // Network error — leave the user alone. Better than a noisy alert.
      }
    };

    void check();

    // Re-check when the tab becomes visible again (covers waking from sleep,
    // returning from another app, or restoring from bfcache).
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [currentBuildId]);
}
