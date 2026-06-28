"use client";

import { useEffect } from "react";

const STORAGE_KEY = "ff:buildId";

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
export function useBuildSync() {
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
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          window.localStorage.setItem(STORAGE_KEY, live);
          return;
        }
        if (stored !== live) {
          window.localStorage.setItem(STORAGE_KEY, live);
          // Reload from the server, not from the bfcache.
          window.location.reload();
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
  }, []);
}
