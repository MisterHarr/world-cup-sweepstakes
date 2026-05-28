"use client";

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import {
  asErrorMessage,
  asLiveOpsMode,
  asNonNegativeInt,
  buildIngestAlert,
  buildFixturePayload,
  DEFAULT_LIVE_OPS,
  getLiveOpsModeMeta,
  isRecord,
  toIsoOrEmpty,
  toIsoOrString,
  type IngestResult,
  type LiveOpsMode,
  type LiveOpsProvider,
  type LiveOpsRun,
  type LiveOpsState,
  type SetLiveOpsSettingsPayload,
} from "@/lib/adminFixturesUtils";

interface LiveOpsConfigPanelProps {
  uid: string;
  dangerConfirmed: boolean;
  /** Raw string from the fixture ingest max-matches input; used by contract test. */
  fixtureMaxMatches: string;
  /** Raw string from the fixture ingest cutoff ISO input; used by contract test. */
  fixtureCutoffIso: string;
}

export function LiveOpsConfigPanel({
  uid,
  dangerConfirmed,
  fixtureMaxMatches,
  fixtureCutoffIso,
}: LiveOpsConfigPanelProps) {
  const [liveOps, setLiveOps] = useState<LiveOpsState>(DEFAULT_LIVE_OPS);
  const [liveOpsModeInput, setLiveOpsModeInput] = useState<LiveOpsMode>("disabled");
  const [liveOpsProviderInput, setLiveOpsProviderInput] = useState<LiveOpsProvider>("fixture");
  const [liveOpsMaxInput, setLiveOpsMaxInput] = useState("");
  const [liveOpsCutoffInput, setLiveOpsCutoffInput] = useState("");
  const [liveOpsStatus, setLiveOpsStatus] = useState("");
  const [savingLiveOps, setSavingLiveOps] = useState(false);
  const [providerContractRunning, setProviderContractRunning] = useState(false);
  const [providerContractPreviewing, setProviderContractPreviewing] = useState(false);
  const [providerContractStatus, setProviderContractStatus] = useState("");
  const [providerContractPreview, setProviderContractPreview] = useState("");

  const ingestAlert = buildIngestAlert(liveOps);
  const liveOpsModeMeta = getLiveOpsModeMeta(liveOps.mode);

  useEffect(() => {
    if (!uid) {
      setLiveOps(DEFAULT_LIVE_OPS);
      setLiveOpsModeInput("disabled");
      setLiveOpsProviderInput("fixture");
      setLiveOpsMaxInput("");
      setLiveOpsCutoffInput("");
      return;
    }

    const ref = doc(db, "settings", "liveOps");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLiveOps(DEFAULT_LIVE_OPS);
        setLiveOpsModeInput("disabled");
        setLiveOpsProviderInput("fixture");
        setLiveOpsMaxInput("");
        setLiveOpsCutoffInput("");
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const provider =
        data.provider === "stub" ||
        data.provider === "fixture" ||
        data.provider === "football-data" ||
        data.provider === "provider"
          ? data.provider
          : "fixture";
      const normalizedProvider =
        provider === "provider" ? "football-data" : provider;
      const mode =
        asLiveOpsMode(data.mode) ??
        (data.enabled === true ? "production" : "disabled");
      const maxMatches =
        typeof data.fixtureMaxMatches === "number" && data.fixtureMaxMatches > 0
          ? Math.floor(data.fixtureMaxMatches)
          : 0;
      const cutoffIso =
        typeof data.fixtureCutoffIso === "string" ? data.fixtureCutoffIso : "";
      const updated = toIsoOrEmpty(data.updatedAt);
      const lastSuccessAt = toIsoOrEmpty(data.lastSuccessAt);
      const lastErrorAt = toIsoOrEmpty(data.lastErrorAt);
      const lastErrorMessage =
        typeof data.lastErrorMessage === "string" ? data.lastErrorMessage : "";
      const lastRunAt =
        toIsoOrEmpty(data.lastRunAt) ||
        (typeof data.lastRunAtIso === "string" ? data.lastRunAtIso : "");
      const lastRunStatus =
        data.lastRunStatus === "success" || data.lastRunStatus === "error"
          ? data.lastRunStatus
          : undefined;
      const lastRunProvider =
        data.lastRunProvider === "stub" ||
        data.lastRunProvider === "fixture" ||
        data.lastRunProvider === "football-data" ||
        data.lastRunProvider === "provider"
          ? data.lastRunProvider === "provider"
            ? "football-data"
            : data.lastRunProvider
          : undefined;
      const lastRunMatches = asNonNegativeInt(data.lastRunMatches);
      const lastRunUpdated = asNonNegativeInt(data.lastRunUpdated);
      const consecutiveFailures = asNonNegativeInt(data.consecutiveFailures);

      const recentRuns: LiveOpsRun[] = Array.isArray(data.recentRuns)
        ? data.recentRuns
            .map((run: unknown): LiveOpsRun | null => {
              if (!isRecord(run)) return null;
              const at =
                typeof run.at === "string" && run.at.trim().length > 0
                  ? run.at
                  : "";
              const status =
                run.status === "success" || run.status === "error"
                  ? run.status
                  : null;
              const runProvider =
                run.provider === "stub" ||
                run.provider === "fixture" ||
                run.provider === "football-data" ||
                run.provider === "provider"
                  ? run.provider === "provider"
                    ? "football-data"
                    : run.provider
                  : null;
              if (!at || !status || !runProvider) return null;
              return {
                at,
                status,
                provider: runProvider,
                matches: asNonNegativeInt(run.matches),
                updated: asNonNegativeInt(run.updated),
                errorMessage:
                  typeof run.errorMessage === "string"
                    ? run.errorMessage
                    : undefined,
              };
            })
            .filter((run): run is LiveOpsRun => run !== null)
            .slice(0, 12)
        : [];

      const nextState: LiveOpsState = {
        enabled: mode !== "disabled",
        mode,
        provider: normalizedProvider,
        fixtureMaxMatches: maxMatches,
        fixtureCutoffIso: cutoffIso,
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
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
      setLiveOpsModeInput(nextState.mode);
      setLiveOpsProviderInput(nextState.provider);
      setLiveOpsMaxInput(
        nextState.fixtureMaxMatches > 0 ? String(nextState.fixtureMaxMatches) : ""
      );
      setLiveOpsCutoffInput(nextState.fixtureCutoffIso);
    });

    return () => unsub();
  }, [uid]);

  async function saveLiveOpsSettings() {
    setLiveOpsStatus("");
    if (!uid) {
      setLiveOpsStatus("❌ Not signed in.");
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
    setLiveOpsStatus("Saving settings...");

    try {
      const fn = httpsCallable<SetLiveOpsSettingsPayload, unknown>(
        functions,
        "setLiveOpsSettings"
      );
      await fn({
        mode: liveOpsModeInput,
        provider: liveOpsProviderInput,
        fixtureMaxMatches: maxRaw ? Math.floor(maxParsed) : 0,
        fixtureCutoffIso: cutoffTrimmed || null,
      });
      setLiveOpsStatus(
        `✅ Settings saved: ${liveOpsModeInput} mode, ${liveOpsProviderInput}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setLiveOpsStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setSavingLiveOps(false);
    }
  }

  async function previewProviderContractTest() {
    setProviderContractStatus("");
    setProviderContractPreview("");
    if (!uid) {
      setProviderContractPreview("❌ Not authorized.");
      return;
    }

    if (liveOpsProviderInput !== "football-data") {
      setProviderContractPreview(
        "❌ Select 'Live scores (football-data.org)' as the data source to run this test."
      );
      return;
    }

    setProviderContractPreviewing(true);
    try {
      const { payload } = buildFixturePayload(fixtureMaxMatches, fixtureCutoffIso);
      const fn = httpsCallable<
        { provider: LiveOpsProvider; maxMatches?: number; cutoffIso?: string; dryRun?: boolean },
        IngestResult
      >(functions, "adminContractTestProvider");
      const res = await fn({
        provider: liveOpsProviderInput,
        maxMatches: payload.maxMatches,
        cutoffIso: payload.cutoffIso,
        dryRun: true,
      });
      const data = res.data;
      setProviderContractPreview(
        `Preview: ${data.matches ?? 0} match(es) available from ${data.provider ?? liveOpsProviderInput}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setProviderContractPreview(`❌ ${asErrorMessage(err)}`);
    } finally {
      setProviderContractPreviewing(false);
    }
  }

  async function runProviderContractTest() {
    setProviderContractStatus("");
    setProviderContractPreview("");
    if (!uid) {
      setProviderContractStatus("❌ Not authorized.");
      return;
    }

    if (liveOpsProviderInput !== "football-data") {
      setProviderContractStatus(
        "❌ Select 'Live scores (football-data.org)' as the data source to run this test."
      );
      return;
    }

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } = buildFixturePayload(
      fixtureMaxMatches,
      fixtureCutoffIso
    );
    const summary = [
      `Run live score feed test for ${liveOpsProviderInput}?`,
      "- Results go to a safe sandbox (no public changes).",
      hasMax ? `- Limit: ${max} matches` : "- All matches",
      hasCutoff ? `- Cut off before: ${trimmedCutoff}` : "- No date cutoff",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setProviderContractStatus("Cancelled.");
      return;
    }

    setProviderContractRunning(true);
    setProviderContractStatus("Running live score feed test (safe mode)...");

    try {
      const fn = httpsCallable<
        { provider: LiveOpsProvider; maxMatches?: number; cutoffIso?: string; dryRun?: boolean },
        IngestResult
      >(functions, "adminContractTestProvider");
      const res = await fn({
        provider: liveOpsProviderInput,
        maxMatches: payload.maxMatches,
        cutoffIso: payload.cutoffIso,
      });
      const data = res.data;
      setProviderContractStatus(
        `✅ Test complete: ${data.matches ?? 0} match(es) processed, ${data.updated ?? 0} updated${data.quarantined ? `, ${data.quarantined} skipped` : ""}. No public data was changed.`
      );
    } catch (err: unknown) {
      console.error(err);
      setProviderContractStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setProviderContractRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-100">
            Live Score Updates
          </div>
          <div className="text-xs text-slate-400">
            Leave off when the tournament isn't active.
          </div>
        </div>
        <div
          className={`text-xs font-semibold px-2 py-1 rounded-full border ${liveOpsModeMeta.classes}`}
        >
          {liveOpsModeMeta.badge}
        </div>
      </div>

      <div className="text-xs text-slate-400">{liveOpsModeMeta.description}</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm text-slate-300">
          Mode
          <select
            value={liveOpsModeInput}
            onChange={(e) => setLiveOpsModeInput(e.target.value as LiveOpsMode)}
            className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="disabled">Disabled</option>
            <option value="shadow">Shadow</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </label>

        <label className="block text-sm text-slate-300">
          Data source
          <select
            value={liveOpsProviderInput}
            onChange={(e) =>
              setLiveOpsProviderInput(e.target.value as LiveOpsProvider)
            }
            className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="fixture">Test data (safe)</option>
            <option value="football-data">Live scores (football-data.org)</option>
            <option value="stub">Off (no data)</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm text-slate-300">
          Limit matches (optional)
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
          Cut off before date (optional)
          <input
            type="text"
            value={liveOpsCutoffInput}
            onChange={(e) => setLiveOpsCutoffInput(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            placeholder="e.g., 2026-06-15T00:00:00Z"
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={saveLiveOpsSettings}
          disabled={!uid || savingLiveOps || !dangerConfirmed}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
        >
          {savingLiveOps ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {liveOpsStatus ? (
        <div className="text-sm text-slate-300">{liveOpsStatus}</div>
      ) : null}

      <div className="border-t border-slate-800/60 pt-3 space-y-2">
        <div className="font-semibold text-slate-100">
          Test Live Score Feed
        </div>
        <p className="text-xs text-slate-400">
          Fetches real match data and runs it through validation in a safe
          sandbox — no changes to public scores or the live leaderboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={previewProviderContractTest}
            disabled={
              !uid ||
              providerContractRunning ||
              providerContractPreviewing ||
              !dangerConfirmed
            }
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-sky-500/50 bg-sky-500/10 text-sky-100 font-semibold disabled:opacity-50"
          >
            {providerContractPreviewing
              ? "Checking..."
              : "Preview"}
          </button>
          <button
            onClick={runProviderContractTest}
            disabled={
              !uid ||
              providerContractRunning ||
              providerContractPreviewing ||
              !dangerConfirmed
            }
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-violet-500/90 text-violet-950 font-semibold disabled:opacity-50"
          >
            {providerContractRunning
              ? "Running Test..."
              : "Run Test (safe mode)"}
          </button>
        </div>
        {providerContractPreview ? (
          <div className="text-sm text-slate-300">{providerContractPreview}</div>
        ) : null}
        {providerContractStatus ? (
          <div className="text-sm text-slate-300">{providerContractStatus}</div>
        ) : null}
      </div>

      <div className="text-xs text-slate-400">
        Last update: {liveOps.updatedAt || "—"}{" "}
        {liveOps.updatedBy ? `• by ${liveOps.updatedBy}` : ""}
      </div>

      <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-300 space-y-1">
        <div className="font-semibold text-slate-100">System Status</div>
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
            <span className="text-amber-300">data may be outdated</span>
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
            {liveOps.consecutiveFailures ?? 0} failure(s) in a row
          </span>
        </div>
        <div>
          Last run at: {liveOps.lastRunAt || "—"}{" "}
          {liveOps.lastRunProvider ? `• ${liveOps.lastRunProvider}` : ""}
          {liveOps.mode ? ` • mode ${liveOps.mode}` : ""}
        </div>
        <div>
          Last run: {liveOps.lastRunMatches ?? 0} matches, {liveOps.lastRunUpdated ?? 0} updated
        </div>
        <div>Last success: {liveOps.lastSuccessAt || "—"}</div>
        <div>Last error: {liveOps.lastErrorAt || "—"}</div>
        <div
          className={
            liveOps.lastErrorMessage ? "text-rose-300" : "text-slate-400"
          }
        >
          Error message: {liveOps.lastErrorMessage || "—"}
        </div>

        {liveOps.recentRuns && liveOps.recentRuns.length > 0 ? (
          <div className="mt-2 space-y-1">
            <div className="font-semibold text-slate-100">
              Recent activity ({liveOps.recentRuns.length})
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
  );
}
