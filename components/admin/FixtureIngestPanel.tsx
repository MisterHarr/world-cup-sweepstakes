"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  asErrorMessage,
  buildFixturePayload,
  type FixtureIngestPayload,
  type IngestResult,
  type ResetPreviewResult,
  type ResetResult,
} from "@/lib/adminFixturesUtils";

interface FixtureIngestPanelProps {
  uid: string;
  dangerConfirmed: boolean;
  maxMatches: string;
  cutoffIso: string;
  onMaxMatchesChange: (v: string) => void;
  onCutoffIsoChange: (v: string) => void;
}

export function FixtureIngestPanel({
  uid,
  dangerConfirmed,
  maxMatches,
  cutoffIso,
  onMaxMatchesChange,
  onCutoffIsoChange,
}: FixtureIngestPanelProps) {
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [resetPreview, setResetPreview] = useState("");
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [resetRunning, setResetRunning] = useState(false);
  const [resetPreviewing, setResetPreviewing] = useState(false);
  const [preTournamentRunning, setPreTournamentRunning] = useState(false);
  const [preTournamentPreviewing, setPreTournamentPreviewing] = useState(false);
  const [preTournamentStatus, setPreTournamentStatus] = useState("");
  const [preTournamentPreview, setPreTournamentPreview] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  async function runFixtureIngest() {
    setStatus("");
    setPreview("");
    setResetStatus("");
    setResetPreview("");
    if (!uid) {
      setStatus("❌ Not signed in.");
      return;
    }

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } = buildFixturePayload(
      maxMatches,
      cutoffIso
    );
    const summary = [
      "Load match data?",
      hasMax ? `- Limit: ${max} matches` : "- All matches",
      hasCutoff ? `- Cut off before: ${trimmedCutoff}` : "- No date cutoff",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setStatus("Cancelled.");
      return;
    }

    setRunning(true);
    setStatus("Loading match data...");

    try {
      const fn = httpsCallable<FixtureIngestPayload, IngestResult>(
        functions,
        "adminIngestFixture"
      );
      const res = await fn(payload);
      const data = res.data;
      setStatus(
        `✅ Ingested ${data?.matches ?? 0} matches, updated ${data?.updated ?? 0}. Leaderboard recomputed.`
      );
    } catch (err: unknown) {
      console.error(err);
      setStatus(`❌ ${asErrorMessage(err)}`);
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

    setPreviewing(true);
    try {
      const fn = httpsCallable<FixtureIngestPayload, IngestResult>(
        functions,
        "adminIngestFixture"
      );
      const { payload } = buildFixturePayload(maxMatches, cutoffIso);
      const dryRunPayload: { maxMatches?: number; cutoffIso?: string; dryRun: true } = {
        dryRun: true,
      };
      if (payload.maxMatches !== undefined) dryRunPayload.maxMatches = payload.maxMatches;
      if (payload.cutoffIso) dryRunPayload.cutoffIso = payload.cutoffIso;

      const res = await fn(dryRunPayload);
      const data = res.data;
      setPreview(`Preview: ${data?.matches ?? 0} matches selected.`);
    } catch (err: unknown) {
      console.error(err);
      setPreview(`❌ ${asErrorMessage(err)}`);
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

    setResetPreviewing(true);
    try {
      const fn = httpsCallable<FixtureIngestPayload, ResetPreviewResult>(
        functions,
        "adminResetFixtureIngest"
      );
      const { payload } = buildFixturePayload(maxMatches, cutoffIso);
      const dryRunPayload: { maxMatches?: number; cutoffIso?: string; dryRun: true } = {
        dryRun: true,
      };
      if (payload.maxMatches !== undefined) dryRunPayload.maxMatches = payload.maxMatches;
      if (payload.cutoffIso) dryRunPayload.cutoffIso = payload.cutoffIso;

      const res = await fn(dryRunPayload);
      const data = res.data;
      setResetPreview(
        `Reset preview: delete ${data?.willDelete ?? 0} fixture matches, then ingest ${data?.willIngest ?? 0} matches.`
      );
    } catch (err: unknown) {
      console.error(err);
      setResetPreview(`❌ ${asErrorMessage(err)}`);
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

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } = buildFixturePayload(
      maxMatches,
      cutoffIso
    );
    const summary = [
      "Clear all match data and reload?",
      "- Existing matches will be deleted first.",
      hasMax ? `- Limit: ${max} matches` : "- All matches",
      hasCutoff ? `- Cut off before: ${trimmedCutoff}` : "- No date cutoff",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setResetStatus("Cancelled.");
      return;
    }

    setResetRunning(true);
    setResetStatus("Resetting fixture matches and ingesting selection...");

    try {
      const fn = httpsCallable<FixtureIngestPayload, ResetResult>(
        functions,
        "adminResetFixtureIngest"
      );
      const res = await fn(payload);
      const data = res.data;
      setResetStatus(
        `✅ Reset deleted ${data?.deletedFixtureMatches ?? 0} fixture matches, ingested ${data?.matches ?? 0}, updated ${data?.updated ?? 0}. Leaderboard recomputed.`
      );
    } catch (err: unknown) {
      console.error(err);
      setResetStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setResetRunning(false);
    }
  }

  async function previewPreTournament() {
    setPreTournamentStatus("");
    setPreTournamentPreview("");
    if (!uid) {
      setPreTournamentPreview("❌ Not authorized.");
      return;
    }

    setPreTournamentPreviewing(true);
    try {
      const fn = httpsCallable<{ dryRun?: boolean }, IngestResult>(
        functions,
        "adminIngestPreTournament"
      );
      const res = await fn({ dryRun: true });
      const data = res.data;
      setPreTournamentPreview(
        `Preview: ${data?.matches ?? 0} pre-tournament matches available.`
      );
    } catch (err: unknown) {
      console.error(err);
      setPreTournamentPreview(`❌ ${asErrorMessage(err)}`);
    } finally {
      setPreTournamentPreviewing(false);
    }
  }

  async function runPreTournamentIngest() {
    setPreTournamentStatus("");
    setPreTournamentPreview("");
    if (!uid) {
      setPreTournamentStatus("❌ Not authorized.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Import pre-tournament match data? This will add historical friendlies and qualifiers."
      )
    ) {
      setPreTournamentStatus("Cancelled.");
      return;
    }

    setPreTournamentRunning(true);
    setPreTournamentStatus("Importing pre-tournament matches...");

    try {
      const fn = httpsCallable<{ dryRun?: boolean }, IngestResult>(
        functions,
        "adminIngestPreTournament"
      );
      const res = await fn({});
      const data = res.data;
      setPreTournamentStatus(
        `✅ Imported ${data?.matches ?? 0} pre-tournament matches, updated ${data?.updated ?? 0}. Leaderboard recomputed.`
      );
    } catch (err: unknown) {
      console.error(err);
      setPreTournamentStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setPreTournamentRunning(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
        Filters — optional, leave blank to load all matches:
      </div>

      <div className="space-y-3">
        <label className="block text-sm text-slate-300">
          Max matches
          <input
            type="number"
            min="1"
            value={maxMatches}
            onChange={(e) => onMaxMatchesChange(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            placeholder="e.g., 4"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Cut off before date
          <input
            type="text"
            value={cutoffIso}
            onChange={(e) => onCutoffIsoChange(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            placeholder="e.g., 2026-06-15T00:00:00Z"
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={runFixtureIngest}
          disabled={!uid || running || !acknowledged || !dangerConfirmed}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
        >
          {running ? "Loading..." : "Load Match Data"}
        </button>

        <button
          onClick={previewFixture}
          disabled={!uid || previewing}
          className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
        >
          {previewing ? "Checking..." : "Preview"}
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="h-4 w-4"
        />
        I'm ready to load match data.
      </label>

      {preview ? <div className="text-sm text-slate-300">{preview}</div> : null}
      <div className="text-sm text-slate-300">{status}</div>

      <div className="border-t border-slate-800/60 pt-4 space-y-3">
        <div className="text-sm font-semibold text-slate-100">
          Fresh Load
        </div>
        <p className="text-xs text-slate-400">
          Clears all current match data, then loads the selected matches fresh. Use this for a clean reset.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={runResetFixtureIngest}
            disabled={!uid || resetRunning || running || !acknowledged || !dangerConfirmed}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500/90 text-amber-950 font-semibold disabled:opacity-50"
          >
            {resetRunning ? "Loading..." : "Clear & Reload"}
          </button>

          <button
            onClick={previewResetFixture}
            disabled={!uid || resetPreviewing || previewing || resetRunning}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
          >
            {resetPreviewing ? "Checking..." : "Preview"}
          </button>
        </div>
        {resetPreview ? (
          <div className="text-sm text-slate-300">{resetPreview}</div>
        ) : null}
        {resetStatus ? (
          <div className="text-sm text-slate-300">{resetStatus}</div>
        ) : null}
      </div>

      <div className="border-t border-slate-800/60 pt-4 space-y-3">
        <div className="text-sm font-semibold text-slate-100">
          Pre-Tournament History
        </div>
        <p className="text-xs text-slate-400">
          Import friendlies and qualifiers so players see match history from day one.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={runPreTournamentIngest}
            disabled={!uid || preTournamentRunning || !acknowledged || !dangerConfirmed}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
          >
            {preTournamentRunning ? "Importing..." : "Import History"}
          </button>

          <button
            onClick={previewPreTournament}
            disabled={!uid || preTournamentPreviewing}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
          >
            {preTournamentPreviewing ? "Checking..." : "Preview"}
          </button>
        </div>

        {preTournamentPreview ? (
          <div className="text-sm text-slate-300">{preTournamentPreview}</div>
        ) : null}
        {preTournamentStatus ? (
          <div className="text-sm text-slate-300">{preTournamentStatus}</div>
        ) : null}
      </div>
    </>
  );
}
