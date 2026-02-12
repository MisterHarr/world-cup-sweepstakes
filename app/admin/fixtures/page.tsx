"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, functions } from "@/lib/firebase";
import { getIdTokenResult } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function FixtureIngestPage() {
  type LiveOpsProvider = "stub" | "fixture" | "provider";
  type LiveOpsRun = {
    at: string;
    status: "success" | "error";
    provider: LiveOpsProvider;
    matches: number;
    updated: number;
    errorMessage?: string;
  };
  type LiveOpsState = {
    enabled: boolean;
    provider: LiveOpsProvider;
    fixtureMaxMatches: number;
    fixtureCutoffIso: string;
    updatedBy?: string;
    updatedAt?: string;
    lastSuccessAt?: string;
    lastErrorAt?: string;
    lastErrorMessage?: string;
    lastRunAt?: string;
    lastRunStatus?: "success" | "error";
    lastRunProvider?: LiveOpsProvider;
    lastRunMatches?: number;
    lastRunUpdated?: number;
    consecutiveFailures?: number;
    recentRuns?: LiveOpsRun[];
  };

  const DEFAULT_LIVE_OPS: LiveOpsState = {
    enabled: false,
    provider: "fixture",
    fixtureMaxMatches: 0,
    fixtureCutoffIso: "",
    consecutiveFailures: 0,
    recentRuns: [],
  };

  type IngestAlertLevel = "healthy" | "warning" | "critical";
  type IngestAlert = {
    level: IngestAlertLevel;
    label: "Healthy" | "Warning" | "Critical";
    message: string;
    stale: boolean;
  };

  const SCHEDULER_INTERVAL_MINUTES = 10;
  const STALE_AFTER_MINUTES = SCHEDULER_INTERVAL_MINUTES * 3;

  function toMillisOrNull(value?: string): number | null {
    if (!value || typeof value !== "string") return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function buildIngestAlert(state: LiveOpsState): IngestAlert {
    if (!state.enabled) {
      return {
        level: "healthy",
        label: "Healthy",
        message: "Automation is disabled (cost-safe mode).",
        stale: false,
      };
    }

    const failures = Math.max(0, Number(state.consecutiveFailures ?? 0));
    const lastRunMs = toMillisOrNull(state.lastRunAt);
    const stale =
      lastRunMs === null ||
      Date.now() - lastRunMs > STALE_AFTER_MINUTES * 60 * 1000;

    if (failures >= 3 || (stale && failures >= 1)) {
      return {
        level: "critical",
        label: "Critical",
        message: stale
          ? `Scheduler appears stale and has ${failures} consecutive failure(s).`
          : `Scheduler has ${failures} consecutive failures.`,
        stale,
      };
    }

    if (state.lastRunStatus === "error" || failures >= 1 || stale) {
      if (stale && lastRunMs === null) {
        return {
          level: "warning",
          label: "Warning",
          message: "Automation is enabled but no scheduler run has been recorded yet.",
          stale: true,
        };
      }

      return {
        level: "warning",
        label: "Warning",
        message: stale
          ? `No run in the last ${STALE_AFTER_MINUTES} minutes.`
          : "Latest scheduler run reported an error.",
        stale,
      };
    }

    return {
      level: "healthy",
      label: "Healthy",
      message: "Latest scheduler run succeeded and health is stable.",
      stale: false,
    };
  }

  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [resetPreview, setResetPreview] = useState("");
  const [maxMatches, setMaxMatches] = useState("");
  const [cutoffIso, setCutoffIso] = useState("");
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [resetRunning, setResetRunning] = useState(false);
  const [resetPreviewing, setResetPreviewing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [leaderboardStatus, setLeaderboardStatus] = useState<{
    lastUpdated?: string;
    scoringVersion?: string;
    includeLive?: boolean;
  }>({});
  const [recomputeStatus, setRecomputeStatus] = useState("");
  const [recomputing, setRecomputing] = useState(false);
  const [liveOpsStatus, setLiveOpsStatus] = useState("");
  const [savingLiveOps, setSavingLiveOps] = useState(false);
  const [liveOps, setLiveOps] = useState<LiveOpsState>(DEFAULT_LIVE_OPS);
  const [liveOpsEnabledInput, setLiveOpsEnabledInput] = useState(false);
  const [liveOpsProviderInput, setLiveOpsProviderInput] =
    useState<LiveOpsProvider>("fixture");
  const [liveOpsMaxInput, setLiveOpsMaxInput] = useState("");
  const [liveOpsCutoffInput, setLiveOpsCutoffInput] = useState("");
  const [checking, setChecking] = useState(true);

  const ingestAlert = useMemo(() => buildIngestAlert(liveOps), [liveOps]);

  function toIsoOrEmpty(value: any): string {
    return value?.toDate?.() instanceof Date ? value.toDate().toISOString() : "";
  }

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setUid(user?.uid ?? null);
      setIsAdmin(false);
      setChecking(true);

      if (!user) {
        setChecking(false);
        return;
      }

      try {
        const token = await getIdTokenResult(user, true);
        setIsAdmin(token.claims.admin === true);
      } catch (err) {
        console.error(err);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid || !isAdmin) {
      setLeaderboardStatus({});
      return;
    }

    const ref = doc(db, "leaderboard", "current");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLeaderboardStatus({});
        return;
      }

      const data = snap.data() as any;
      const updated =
        data?.lastUpdated?.toDate?.() instanceof Date
          ? data.lastUpdated.toDate().toISOString()
          : "";

      setLeaderboardStatus({
        lastUpdated: updated,
        scoringVersion: data?.scoringVersion,
        includeLive: data?.includeLive,
      });
    });

    return () => unsub();
  }, [uid, isAdmin]);

  useEffect(() => {
    if (!uid || !isAdmin) {
      setLiveOps(DEFAULT_LIVE_OPS);
      setLiveOpsEnabledInput(false);
      setLiveOpsProviderInput("fixture");
      setLiveOpsMaxInput("");
      setLiveOpsCutoffInput("");
      return;
    }

    const ref = doc(db, "settings", "liveOps");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLiveOps(DEFAULT_LIVE_OPS);
        setLiveOpsEnabledInput(false);
        setLiveOpsProviderInput("fixture");
        setLiveOpsMaxInput("");
        setLiveOpsCutoffInput("");
        return;
      }

      const data = snap.data() as any;
      const provider =
        data?.provider === "stub" ||
        data?.provider === "fixture" ||
        data?.provider === "provider"
          ? (data.provider as LiveOpsProvider)
          : "fixture";
      const maxMatches =
        typeof data?.fixtureMaxMatches === "number" && data.fixtureMaxMatches > 0
          ? Math.floor(data.fixtureMaxMatches)
          : 0;
      const cutoffIso =
        typeof data?.fixtureCutoffIso === "string" ? data.fixtureCutoffIso : "";
      const updated = toIsoOrEmpty(data?.updatedAt);
      const lastSuccessAt = toIsoOrEmpty(data?.lastSuccessAt);
      const lastErrorAt = toIsoOrEmpty(data?.lastErrorAt);
      const lastErrorMessage =
        typeof data?.lastErrorMessage === "string" ? data.lastErrorMessage : "";
      const lastRunAt =
        toIsoOrEmpty(data?.lastRunAt) ||
        (typeof data?.lastRunAtIso === "string" ? data.lastRunAtIso : "");
      const lastRunStatus =
        data?.lastRunStatus === "success" || data?.lastRunStatus === "error"
          ? data.lastRunStatus
          : undefined;
      const lastRunProvider =
        data?.lastRunProvider === "stub" ||
        data?.lastRunProvider === "fixture" ||
        data?.lastRunProvider === "provider"
          ? (data.lastRunProvider as LiveOpsProvider)
          : undefined;
      const lastRunMatches =
        typeof data?.lastRunMatches === "number" && Number.isFinite(data.lastRunMatches)
          ? Math.max(0, Math.floor(data.lastRunMatches))
          : 0;
      const lastRunUpdated =
        typeof data?.lastRunUpdated === "number" && Number.isFinite(data.lastRunUpdated)
          ? Math.max(0, Math.floor(data.lastRunUpdated))
          : 0;
      const consecutiveFailures =
        typeof data?.consecutiveFailures === "number" &&
        Number.isFinite(data.consecutiveFailures)
          ? Math.max(0, Math.floor(data.consecutiveFailures))
          : 0;

      const recentRuns: LiveOpsRun[] = Array.isArray(data?.recentRuns)
        ? data.recentRuns
            .map((run: any): LiveOpsRun | null => {
              const at =
                typeof run?.at === "string" && run.at.trim().length > 0
                  ? run.at
                  : "";
              const status =
                run?.status === "success" || run?.status === "error"
                  ? (run.status as "success" | "error")
                  : null;
              const provider =
                run?.provider === "stub" ||
                run?.provider === "fixture" ||
                run?.provider === "provider"
                  ? (run.provider as LiveOpsProvider)
                  : null;
              if (!at || !status || !provider) return null;

              return {
                at,
                status,
                provider,
                matches:
                  typeof run?.matches === "number" && Number.isFinite(run.matches)
                    ? Math.max(0, Math.floor(run.matches))
                    : 0,
                updated:
                  typeof run?.updated === "number" && Number.isFinite(run.updated)
                    ? Math.max(0, Math.floor(run.updated))
                    : 0,
                errorMessage:
                  typeof run?.errorMessage === "string"
                    ? run.errorMessage
                    : undefined,
              };
            })
            .filter(Boolean)
            .slice(0, 12) as LiveOpsRun[]
        : [];

      const nextState: LiveOpsState = {
        enabled: data?.enabled === true,
        provider,
        fixtureMaxMatches: maxMatches,
        fixtureCutoffIso: cutoffIso,
        updatedBy: typeof data?.updatedBy === "string" ? data.updatedBy : "",
        updatedAt: updated,
        lastSuccessAt,
        lastErrorAt,
        lastErrorMessage,
        lastRunAt,
        lastRunStatus,
        lastRunProvider,
        lastRunMatches,
        lastRunUpdated,
        consecutiveFailures,
        recentRuns,
      };

      setLiveOps(nextState);
      setLiveOpsEnabledInput(nextState.enabled);
      setLiveOpsProviderInput(nextState.provider);
      setLiveOpsMaxInput(
        nextState.fixtureMaxMatches > 0 ? String(nextState.fixtureMaxMatches) : ""
      );
      setLiveOpsCutoffInput(nextState.fixtureCutoffIso);
    });

    return () => unsub();
  }, [uid, isAdmin]);

  function getFixtureSelection() {
    const max = Number(maxMatches);
    const hasMax = Number.isFinite(max) && max > 0;
    const trimmedCutoff = cutoffIso.trim();
    const hasCutoff = trimmedCutoff.length > 0;
    const payload: { maxMatches?: number; cutoffIso?: string } = {};

    if (hasMax) payload.maxMatches = max;
    if (hasCutoff) payload.cutoffIso = trimmedCutoff;

    return { max, hasMax, hasCutoff, trimmedCutoff, payload };
  }

  async function runFixtureIngest() {
    setStatus("");
    setPreview("");
    setResetStatus("");
    setResetPreview("");
    if (!uid) {
      setStatus("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setStatus("❌ Admin access required.");
      return;
    }

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } =
      getFixtureSelection();
    const summary = [
      "Run fixture ingest?",
      hasMax ? `- maxMatches: ${max}` : "- maxMatches: (all)",
      hasCutoff ? `- cutoffIso: ${trimmedCutoff}` : "- cutoffIso: (none)",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setStatus("Cancelled.");
      return;
    }

    setRunning(true);
    setStatus("Running fixture ingest...");

    try {
      const fn = httpsCallable(functions, "adminIngestFixture");
      const res = await fn(payload);
      const data = res.data as any;

      setStatus(
        `✅ Ingested ${data?.matches ?? 0} matches, updated ${data?.updated ?? 0}. ` +
          `Leaderboard recomputed.`
      );
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  async function previewFixture() {
    setStatus("");
    setPreview("");
    setResetStatus("");
    setResetPreview("");
    if (!uid) {
      setPreview("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setPreview("❌ Admin access required.");
      return;
    }

    setPreviewing(true);
    try {
      const fn = httpsCallable(functions, "adminIngestFixture");
      const { payload } = getFixtureSelection();
      const dryRunPayload: {
        maxMatches?: number;
        cutoffIso?: string;
        dryRun: true;
      } = {
        dryRun: true,
      };
      if (payload.maxMatches !== undefined) {
        dryRunPayload.maxMatches = payload.maxMatches;
      }
      if (payload.cutoffIso) {
        dryRunPayload.cutoffIso = payload.cutoffIso;
      }

      const res = await fn(dryRunPayload);
      const data = res.data as any;

      setPreview(`Preview: ${data?.matches ?? 0} matches selected.`);
    } catch (err: any) {
      console.error(err);
      setPreview(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setPreviewing(false);
    }
  }

  async function previewResetFixture() {
    setResetStatus("");
    setResetPreview("");
    setStatus("");
    if (!uid) {
      setResetPreview("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setResetPreview("❌ Admin access required.");
      return;
    }

    setResetPreviewing(true);
    try {
      const fn = httpsCallable(functions, "adminResetFixtureIngest");
      const { payload } = getFixtureSelection();
      const dryRunPayload: {
        maxMatches?: number;
        cutoffIso?: string;
        dryRun: true;
      } = {
        dryRun: true,
      };

      if (payload.maxMatches !== undefined) {
        dryRunPayload.maxMatches = payload.maxMatches;
      }
      if (payload.cutoffIso) {
        dryRunPayload.cutoffIso = payload.cutoffIso;
      }

      const res = await fn(dryRunPayload);
      const data = res.data as any;
      setResetPreview(
        `Reset preview: delete ${data?.willDelete ?? 0} fixture matches, then ingest ${data?.willIngest ?? 0} matches.`
      );
    } catch (err: any) {
      console.error(err);
      setResetPreview(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setResetPreviewing(false);
    }
  }

  async function runResetFixtureIngest() {
    setResetStatus("");
    setResetPreview("");
    setStatus("");
    setPreview("");
    if (!uid) {
      setResetStatus("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setResetStatus("❌ Admin access required.");
      return;
    }

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } =
      getFixtureSelection();
    const summary = [
      "Reset fixture state and ingest selection?",
      "- Existing fixture matches will be deleted first.",
      hasMax ? `- maxMatches: ${max}` : "- maxMatches: (all)",
      hasCutoff ? `- cutoffIso: ${trimmedCutoff}` : "- cutoffIso: (none)",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setResetStatus("Cancelled.");
      return;
    }

    setResetRunning(true);
    setResetStatus("Resetting fixture matches and ingesting selection...");

    try {
      const fn = httpsCallable(functions, "adminResetFixtureIngest");
      const res = await fn(payload);
      const data = res.data as any;
      setResetStatus(
        `✅ Reset deleted ${data?.deletedFixtureMatches ?? 0} fixture matches, ingested ${data?.matches ?? 0}, updated ${data?.updated ?? 0}. Leaderboard recomputed.`
      );
    } catch (err: any) {
      console.error(err);
      setResetStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setResetRunning(false);
    }
  }

  async function recomputeLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setRecomputeStatus("❌ Admin access required.");
      return;
    }

    setRecomputing(true);
    setRecomputeStatus("Recomputing leaderboard...");

    try {
      const fn = httpsCallable(functions, "recomputeScores");
      const res = await fn({ includeLive: true, scoringVersion: "v1" });
      const data = res.data as any;
      setRecomputeStatus(
        `✅ Recomputed for ${data?.users ?? 0} users (${data?.matches ?? 0} matches).`
      );
    } catch (err: any) {
      console.error(err);
      setRecomputeStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setRecomputing(false);
    }
  }

  async function saveLiveOpsSettings() {
    setLiveOpsStatus("");
    if (!uid) {
      setLiveOpsStatus("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setLiveOpsStatus("❌ Admin access required.");
      return;
    }

    const maxRaw = liveOpsMaxInput.trim();
    const maxParsed = maxRaw ? Number(maxRaw) : 0;
    if (maxRaw && (!Number.isFinite(maxParsed) || maxParsed < 0)) {
      setLiveOpsStatus("❌ Max matches must be a non-negative number.");
      return;
    }

    const cutoffTrimmed = liveOpsCutoffInput.trim();

    setSavingLiveOps(true);
    setLiveOpsStatus("Saving automation settings...");

    try {
      const fn = httpsCallable(functions, "setLiveOpsSettings");
      await fn({
        enabled: liveOpsEnabledInput,
        provider: liveOpsProviderInput,
        fixtureMaxMatches: maxRaw ? Math.floor(maxParsed) : 0,
        fixtureCutoffIso: cutoffTrimmed || null,
      });
      setLiveOpsStatus(
        `✅ Automation ${liveOpsEnabledInput ? "enabled" : "disabled"} (${liveOpsProviderInput}).`
      );
    } catch (err: any) {
      console.error(err);
      setLiveOpsStatus(`❌ ${err?.message ?? String(err)}`);
    } finally {
      setSavingLiveOps(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin · Fixture Ingest
            </h1>
            <a
              href="/admin"
              className="text-xs uppercase tracking-widest text-slate-400 hover:text-emerald-200"
            >
              Back to Tools
            </a>
          </div>

          <div className="text-sm text-slate-300">
            Signed in: <strong>{uid ? "Yes" : "No"}</strong>{" · "}
            Admin: <strong>{isAdmin ? "Yes" : "No"}</strong>
          </div>

          {checking ? (
            <div className="text-sm text-slate-400">Checking access…</div>
          ) : !uid ? (
            <div className="text-sm text-slate-400">
              Please sign in to access admin tools.
            </div>
          ) : !isAdmin ? (
            <div className="text-sm text-slate-400">Not authorized.</div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100">
                      Live Automation (Scheduler)
                    </div>
                    <div className="text-xs text-slate-400">
                      Default is OFF to keep costs near zero in dev.
                    </div>
                  </div>
                  <div
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                      liveOps.enabled
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-700/70 bg-slate-900/70 text-slate-300"
                    }`}
                  >
                    {liveOps.enabled ? "ENABLED" : "DISABLED"}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm text-slate-300">
                    Provider
                    <select
                      value={liveOpsProviderInput}
                      onChange={(e) =>
                        setLiveOpsProviderInput(e.target.value as LiveOpsProvider)
                      }
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="fixture">Fixture (safe testing)</option>
                      <option value="provider">Provider (production)</option>
                      <option value="stub">Stub (no ingest)</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-300 mt-6 sm:mt-8">
                    <input
                      type="checkbox"
                      checked={liveOpsEnabledInput}
                      onChange={(e) => setLiveOpsEnabledInput(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Enable scheduled ingest
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm text-slate-300">
                    Fixture max matches (optional)
                    <input
                      type="number"
                      min="0"
                      value={liveOpsMaxInput}
                      onChange={(e) => setLiveOpsMaxInput(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                      placeholder="0 = all"
                    />
                  </label>

                  <label className="block text-sm text-slate-300">
                    Fixture cutoff ISO (optional)
                    <input
                      type="text"
                      value={liveOpsCutoffInput}
                      onChange={(e) => setLiveOpsCutoffInput(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                      placeholder="e.g., 2022-11-22T00:00:00Z"
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    onClick={saveLiveOpsSettings}
                    disabled={!uid || !isAdmin || savingLiveOps}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
                  >
                    {savingLiveOps ? "Saving..." : "Save Automation Settings"}
                  </button>
                </div>

                {liveOpsStatus ? (
                  <div className="text-sm text-slate-300">{liveOpsStatus}</div>
                ) : null}

                <div className="text-xs text-slate-400">
                  Last update: {liveOps.updatedAt || "—"}{" "}
                  {liveOps.updatedBy ? `• by ${liveOps.updatedBy}` : ""}
                </div>

                <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-slate-100">Ingest Health</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                        ingestAlert.level === "critical"
                          ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                          : ingestAlert.level === "warning"
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                          : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                      }`}
                    >
                      Status: {ingestAlert.label}
                    </span>
                    {ingestAlert.stale ? (
                      <span className="text-amber-300">stale scheduler signal</span>
                    ) : null}
                  </div>
                  <div
                    className={
                      ingestAlert.level === "critical"
                        ? "text-rose-300"
                        : ingestAlert.level === "warning"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }
                  >
                    {ingestAlert.message}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                        liveOps.lastRunStatus === "error"
                          ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                          : liveOps.lastRunStatus === "success"
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                          : "border-slate-700/70 bg-slate-900/70 text-slate-300"
                      }`}
                    >
                      Last run: {liveOps.lastRunStatus ?? "unknown"}
                    </span>
                    <span className="text-slate-400">
                      failures in a row: {liveOps.consecutiveFailures ?? 0}
                    </span>
                  </div>
                  <div>
                    Last run at: {liveOps.lastRunAt || "—"}{" "}
                    {liveOps.lastRunProvider ? `• ${liveOps.lastRunProvider}` : ""}
                  </div>
                  <div>
                    Last run payload: matches {liveOps.lastRunMatches ?? 0}, updated{" "}
                    {liveOps.lastRunUpdated ?? 0}
                  </div>
                  <div>Last success: {liveOps.lastSuccessAt || "—"}</div>
                  <div>Last error: {liveOps.lastErrorAt || "—"}</div>
                  <div
                    className={
                      liveOps.lastErrorMessage
                        ? "text-rose-300"
                        : "text-slate-400"
                    }
                  >
                    Error message: {liveOps.lastErrorMessage || "—"}
                  </div>

                  {liveOps.recentRuns && liveOps.recentRuns.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <div className="font-semibold text-slate-100">
                        Recent Runs ({liveOps.recentRuns.length})
                      </div>
                      <div className="max-h-40 overflow-auto space-y-1 pr-1">
                        {liveOps.recentRuns.map((run, idx) => (
                          <div
                            key={`${run.at}-${idx}`}
                            className="rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-slate-400">{run.at}</span>
                              <span
                                className={
                                  run.status === "error"
                                    ? "text-rose-300"
                                    : "text-emerald-300"
                                }
                              >
                                {run.status}
                              </span>
                              <span className="text-slate-300">{run.provider}</span>
                              <span className="text-slate-400">
                                m:{run.matches} u:{run.updated}
                              </span>
                            </div>
                            {run.errorMessage ? (
                              <div className="text-rose-300 mt-0.5">
                                {run.errorMessage}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
                Optional controls (leave blank for full fixture):
              </div>

              <div className="space-y-3">
                <label className="block text-sm text-slate-300">
                  Max matches
                  <input
                    type="number"
                    min="1"
                    value={maxMatches}
                    onChange={(e) => setMaxMatches(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    placeholder="e.g., 4"
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Cutoff ISO timestamp
                  <input
                    type="text"
                    value={cutoffIso}
                    onChange={(e) => setCutoffIso(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    placeholder="e.g., 2022-11-22T00:00:00Z"
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={runFixtureIngest}
                  disabled={!uid || !isAdmin || running || !acknowledged}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
                >
                  {running ? "Running..." : "Run Fixture Ingest"}
                </button>

                <button
                  onClick={previewFixture}
                  disabled={!uid || !isAdmin || previewing}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
                >
                  {previewing ? "Previewing..." : "Preview Selection"}
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="h-4 w-4"
                />
                I understand this will write fixture data to Firestore.
              </label>

              {preview ? <div className="text-sm text-slate-300">{preview}</div> : null}
              <div className="text-sm text-slate-300">{status}</div>

              <div className="border-t border-slate-800/60 pt-4 space-y-3">
                <div className="text-sm font-semibold text-slate-100">
                  Deterministic Reset + Ingest
                </div>
                <p className="text-xs text-slate-400">
                  Deletes all fixture-sourced match docs, then ingests the current
                  selection.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    onClick={runResetFixtureIngest}
                    disabled={
                      !uid ||
                      !isAdmin ||
                      resetRunning ||
                      running ||
                      !acknowledged
                    }
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500/90 text-amber-950 font-semibold disabled:opacity-50"
                  >
                    {resetRunning ? "Running..." : "Reset + Ingest"}
                  </button>

                  <button
                    onClick={previewResetFixture}
                    disabled={
                      !uid ||
                      !isAdmin ||
                      resetPreviewing ||
                      previewing ||
                      resetRunning
                    }
                    className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
                  >
                    {resetPreviewing ? "Previewing..." : "Preview Reset"}
                  </button>
                </div>
                {resetPreview ? (
                  <div className="text-sm text-slate-300">{resetPreview}</div>
                ) : null}
                {resetStatus ? (
                  <div className="text-sm text-slate-300">{resetStatus}</div>
                ) : null}
              </div>

              <div className="border-t border-slate-800/60 pt-4 space-y-2">
                <button
                  onClick={recomputeLeaderboard}
                  disabled={!uid || !isAdmin || recomputing}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 disabled:opacity-50"
                >
                  {recomputing ? "Recomputing..." : "Recompute Leaderboard"}
                </button>
                {recomputeStatus ? (
                  <div className="text-sm text-slate-300">{recomputeStatus}</div>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
                <div className="font-semibold mb-2 text-slate-100">
                  Leaderboard Status
                </div>
                <div>
                  Last updated:{" "}
                  {leaderboardStatus.lastUpdated
                    ? leaderboardStatus.lastUpdated
                    : "—"}
                </div>
                <div>
                  Scoring version:{" "}
                  {leaderboardStatus.scoringVersion
                    ? leaderboardStatus.scoringVersion
                    : "—"}
                </div>
                <div>
                  Include live:{" "}
                  {typeof leaderboardStatus.includeLive === "boolean"
                    ? String(leaderboardStatus.includeLive)
                    : "—"}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
