"use client";

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { AdminEnvironmentBadge } from "@/components/admin/AdminEnvironmentBadge";
import { AdminGate } from "@/components/admin/AdminGate";
import { LiveOpsConfigPanel } from "@/components/admin/LiveOpsConfigPanel";
import { LocalVisibleRehearsalPanel } from "@/components/admin/LocalVisibleRehearsalPanel";
import { LocalhostProductionWarning } from "@/components/admin/LocalhostProductionWarning";
import { TransferWindowPanel } from "@/components/admin/TransferWindowPanel";
import { db, functions } from "@/lib/firebase";
import {
  asErrorMessage,
  asNonNegativeInt,
  readLeaderboardRows,
  toIsoOrString,
  type FixtureIngestPayload,
  type FixtureReplayState,
  type IngestHealthState,
  type IngestResult,
  type LeaderboardRowStatus,
  type LeaderboardStatus,
  type RecomputeResult,
  type ReplayResult,
  type ResetPreviewResult,
  type ResetResult,
  type ShadowLeaderboardStatus,
} from "@/lib/adminFixturesUtils";

function FixtureIngestContent(props: { uid: string }) {
  const { uid } = props;

  // ─── State: fixture ingest ──────────────────────────────────────────────────
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
  const [preTournamentRunning, setPreTournamentRunning] = useState(false);
  const [preTournamentPreviewing, setPreTournamentPreviewing] = useState(false);
  const [preTournamentStatus, setPreTournamentStatus] = useState("");
  const [preTournamentPreview, setPreTournamentPreview] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  // ─── State: fixture replay shadow ───────────────────────────────────────────
  const [replayWaveSize, setReplayWaveSize] = useState("4");
  const [replayStatus, setReplayStatus] = useState("");
  const [runningReplay, setRunningReplay] = useState(false);
  const [resettingReplay, setResettingReplay] = useState(false);

  // ─── State: leaderboard recompute ───────────────────────────────────────────
  const [recomputeStatus, setRecomputeStatus] = useState("");
  const [recomputing, setRecomputing] = useState(false);
  const [retryingDirtyRecompute, setRetryingDirtyRecompute] = useState(false);
  const [recomputingShadow, setRecomputingShadow] = useState(false);

  // ─── State: observed data ───────────────────────────────────────────────────
  const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>({});
  const [shadowLeaderboardStatus, setShadowLeaderboardStatus] =
    useState<ShadowLeaderboardStatus>({});
  const [ingestHealth, setIngestHealth] = useState<IngestHealthState>({
    scoresDirty: false,
  });
  const [fixtureReplayState, setFixtureReplayState] = useState<FixtureReplayState>({
    cursor: 0,
    done: false,
    shadowMatchCount: 0,
  });

  // ─── State: danger gate (set by LocalhostProductionWarning) ─────────────────
  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  // ─── Computed: leaderboard diff ─────────────────────────────────────────────
  const leaderboardDiff = (() => {
    const publicRows = leaderboardStatus.rows ?? [];
    const shadowRows = shadowLeaderboardStatus.rows ?? [];
    const publicByUser = new Map(publicRows.map((row) => [row.userId, row]));
    const shadowByUser = new Map(shadowRows.map((row) => [row.userId, row]));
    const userIds = new Set([...publicByUser.keys(), ...shadowByUser.keys()]);
    const mismatches: Array<{
      userId: string;
      displayName: string;
      publicRank: number | null;
      shadowRank: number | null;
      publicScore: number | null;
      shadowScore: number | null;
    }> = [];

    userIds.forEach((userId) => {
      const publicRow = publicByUser.get(userId);
      const shadowRow = shadowByUser.get(userId);
      const publicRank = publicRow?.rank ?? null;
      const shadowRank = shadowRow?.rank ?? null;
      const publicScore = publicRow?.totalScore ?? null;
      const shadowScore = shadowRow?.totalScore ?? null;
      if (publicRank === shadowRank && publicScore === shadowScore) return;
      mismatches.push({
        userId,
        displayName: publicRow?.displayName ?? shadowRow?.displayName ?? userId,
        publicRank,
        shadowRank,
        publicScore,
        shadowScore,
      });
    });

    mismatches.sort((a, b) => {
      const aDelta = Math.abs((a.publicScore ?? 0) - (a.shadowScore ?? 0));
      const bDelta = Math.abs((b.publicScore ?? 0) - (b.shadowScore ?? 0));
      if (bDelta !== aDelta) return bDelta - aDelta;
      return a.displayName.localeCompare(b.displayName);
    });

    return {
      publicCount: publicRows.length,
      shadowCount: shadowRows.length,
      mismatchCount: mismatches.length,
      topMismatches: mismatches.slice(0, 5),
    };
  })();

  // ─── Subscriptions ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!uid) {
      setLeaderboardStatus({});
      setShadowLeaderboardStatus({});
      return;
    }

    const ref = doc(db, "leaderboard", "current");
    const shadowRef = doc(db, "shadowLeaderboard", "current");

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLeaderboardStatus({});
      } else {
        const data = snap.data() as Record<string, unknown>;
        setLeaderboardStatus({
          lastUpdated: toIsoOrString(data.lastUpdated),
          scoringVersion:
            typeof data.scoringVersion === "string" ? data.scoringVersion : undefined,
          includeLive:
            typeof data.includeLive === "boolean" ? data.includeLive : undefined,
          rows: readLeaderboardRows(data),
        });
      }
    });

    const unsubShadow = onSnapshot(shadowRef, (snap) => {
      if (!snap.exists()) {
        setShadowLeaderboardStatus({});
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      setShadowLeaderboardStatus({
        lastUpdated: toIsoOrString(data.lastUpdated),
        lastAttemptAt: toIsoOrString(data.lastAttemptAt),
        scoringVersion:
          typeof data.scoringVersion === "string" ? data.scoringVersion : undefined,
        includeLive:
          typeof data.includeLive === "boolean" ? data.includeLive : undefined,
        rows: readLeaderboardRows(data),
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : undefined,
        rowCount:
          typeof data.rowCount === "number" && Number.isFinite(data.rowCount)
            ? Math.max(0, Math.floor(data.rowCount))
            : undefined,
        sourceCollection:
          typeof data.sourceCollection === "string"
            ? data.sourceCollection
            : undefined,
        target: typeof data.target === "string" ? data.target : undefined,
        lastErrorAt: toIsoOrString(data.lastErrorAt),
        lastErrorMessage:
          typeof data.lastErrorMessage === "string"
            ? data.lastErrorMessage
            : undefined,
      });
    });

    return () => {
      unsub();
      unsubShadow();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setIngestHealth({ scoresDirty: false });
      return;
    }

    const ref = doc(db, "ingestHealth", "current");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setIngestHealth({ scoresDirty: false });
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      setIngestHealth({
        lastIngestAttemptAt: toIsoOrString(data.lastIngestAttemptAt),
        lastIngestSuccessAt: toIsoOrString(data.lastIngestSuccessAt),
        lastIngestErrorAt: toIsoOrString(data.lastIngestErrorAt),
        lastIngestErrorMessage:
          typeof data.lastIngestErrorMessage === "string"
            ? data.lastIngestErrorMessage
            : "",
        lastRecomputeAttemptAt: toIsoOrString(data.lastRecomputeAttemptAt),
        lastRecomputeSuccessAt: toIsoOrString(data.lastRecomputeSuccessAt),
        lastRecomputeErrorAt: toIsoOrString(data.lastRecomputeErrorAt),
        lastRecomputeErrorMessage:
          typeof data.lastRecomputeErrorMessage === "string"
            ? data.lastRecomputeErrorMessage
            : "",
        scoresDirty: data.scoresDirty === true,
        dirtyReason:
          typeof data.dirtyReason === "string" ? data.dirtyReason : null,
        activeProvider:
          typeof data.activeProvider === "string" ? data.activeProvider : "",
        mode: typeof data.mode === "string" ? data.mode : null,
      });
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setFixtureReplayState({ cursor: 0, done: false, shadowMatchCount: 0 });
      return;
    }

    const replayRef = doc(db, "settings", "fixtureReplay");
    const shadowMatchesRef = collection(db, "shadowMatches");

    const unsubReplay = onSnapshot(replayRef, (snap) => {
      const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
      setFixtureReplayState((prev) => ({
        ...prev,
        cursor:
          typeof data.cursor === "number" && Number.isFinite(data.cursor)
            ? Math.max(0, Math.floor(data.cursor))
            : 0,
        waveSize:
          typeof data.waveSize === "number" && Number.isFinite(data.waveSize)
            ? Math.max(1, Math.floor(data.waveSize))
            : null,
        total:
          typeof data.total === "number" && Number.isFinite(data.total)
            ? Math.max(0, Math.floor(data.total))
            : null,
        done: data.done === true,
      }));
    });

    const unsubShadow = onSnapshot(shadowMatchesRef, (snap) => {
      setFixtureReplayState((prev) => ({ ...prev, shadowMatchCount: snap.size }));
    });

    return () => {
      unsubReplay();
      unsubShadow();
    };
  }, [uid]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

  // ─── Handlers: fixture ingest ────────────────────────────────────────────────

  async function runFixtureIngest() {
    setStatus("");
    setPreview("");
    setResetStatus("");
    setResetPreview("");
    if (!uid) {
      setStatus("❌ Not signed in.");
      return;
    }

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } = getFixtureSelection();
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
      const { payload } = getFixtureSelection();
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
      const { payload } = getFixtureSelection();
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

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } = getFixtureSelection();
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

  // ─── Handlers: leaderboard recompute ────────────────────────────────────────

  async function recomputeLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }

    setRecomputing(true);
    setRecomputeStatus("Recomputing leaderboard...");

    try {
      const fn = httpsCallable<Record<string, never>, RecomputeResult>(
        functions,
        "recomputeScores"
      );
      const res = await fn({});
      const data = res.data;
      setRecomputeStatus(
        `✅ Recomputed for ${data?.users ?? 0} users (${data?.matches ?? 0} matches).`
      );
    } catch (err: unknown) {
      console.error(err);
      setRecomputeStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRecomputing(false);
    }
  }

  async function retryDirtyLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }

    setRetryingDirtyRecompute(true);
    setRecomputeStatus("Retrying dirty score recompute...");

    try {
      const fn = httpsCallable<Record<string, never>, RecomputeResult>(
        functions,
        "retryDirtyRecompute"
      );
      const res = await fn({});
      const data = res.data;
      setRecomputeStatus(
        data?.wasDirty
          ? `✅ Dirty recompute complete (${data?.users ?? 0} users, ${data?.matches ?? 0} matches). Reason was: ${data?.dirtyReason ?? "unknown"}.`
          : `✅ Scores were not marked dirty — no retry needed.`
      );
    } catch (err: unknown) {
      console.error(err);
      setRecomputeStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRetryingDirtyRecompute(false);
    }
  }

  async function recomputeShadowLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }

    setRecomputingShadow(true);
    setRecomputeStatus("Recomputing shadow leaderboard...");

    try {
      const fn = httpsCallable<Record<string, never>, RecomputeResult>(
        functions,
        "recomputeShadowScores"
      );
      const res = await fn({});
      const data = res.data;
      setRecomputeStatus(
        `✅ Shadow recomputed for ${data?.users ?? 0} users (${data?.matches ?? 0} matches). Target: ${data?.target ?? "shadowLeaderboard/current"}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setRecomputeStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRecomputingShadow(false);
    }
  }

  // ─── Handlers: fixture replay ────────────────────────────────────────────────

  async function runReplayWave() {
    setReplayStatus("");
    if (!uid) {
      setReplayStatus("❌ Not signed in.");
      return;
    }

    const parsed = Number(replayWaveSize);
    const waveSize =
      Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 4;

    setRunningReplay(true);
    setReplayStatus("Running fixture replay wave into shadowMatches...");

    try {
      const fn = httpsCallable<{ waveSize: number }, ReplayResult>(
        functions,
        "adminReplayFixtureWave"
      );
      const res = await fn({ waveSize });
      const data = res.data;
      setReplayStatus(
        `✅ Replayed ${data?.applied ?? 0} matches (cursor ${data?.cursor ?? 0}→${data?.nextCursor ?? 0} / ${data?.total ?? "?"}).${data?.done ? " Done." : ""} Shadow matches: ${fixtureReplayState.shadowMatchCount + asNonNegativeInt(data?.applied)}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setReplayStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRunningReplay(false);
    }
  }

  async function resetReplayShadow() {
    setReplayStatus("");
    if (!uid) {
      setReplayStatus("❌ Not signed in.");
      return;
    }

    setResettingReplay(true);
    setReplayStatus("Resetting fixture replay shadow...");

    try {
      const fn = httpsCallable<Record<string, never>, ReplayResult>(
        functions,
        "adminResetFixtureReplay"
      );
      const res = await fn({});
      const data = res.data;
      setReplayStatus(
        `✅ Reset replay shadow. Deleted ${data?.deleted ?? 0} shadow match(es).`
      );
    } catch (err: unknown) {
      console.error(err);
      setReplayStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setResettingReplay(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="text-sm text-slate-300">
        Signed in as <strong>{uid}</strong>
      </div>

      <LocalhostProductionWarning onConfirmedChange={setDangerConfirmed} />

      <LiveOpsConfigPanel
        uid={uid}
        dangerConfirmed={dangerConfirmed}
        fixtureMaxMatches={maxMatches}
        fixtureCutoffIso={cutoffIso}
      />

      <TransferWindowPanel uid={uid} dangerConfirmed={dangerConfirmed} />

      <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
        Optional controls (leave blank for full fixture):
      </div>

      <LocalVisibleRehearsalPanel uid={uid} dangerConfirmed={dangerConfirmed} />

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
          disabled={!uid || running || !acknowledged || !dangerConfirmed}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
        >
          {running ? "Running..." : "Run Fixture Ingest"}
        </button>

        <button
          onClick={previewFixture}
          disabled={!uid || previewing}
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
            disabled={!uid || resetRunning || running || !acknowledged || !dangerConfirmed}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500/90 text-amber-950 font-semibold disabled:opacity-50"
          >
            {resetRunning ? "Running..." : "Reset + Ingest"}
          </button>

          <button
            onClick={previewResetFixture}
            disabled={!uid || resetPreviewing || previewing || resetRunning}
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

      <div className="border-t border-slate-800/60 pt-4 space-y-3">
        <div className="text-sm font-semibold text-slate-100">
          Pre-Tournament Match Data
        </div>
        <p className="text-xs text-slate-400">
          Import pre-tournament friendlies and qualifiers (3-5 matches per
          team) so users see match history from day one.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={runPreTournamentIngest}
            disabled={!uid || preTournamentRunning || !acknowledged || !dangerConfirmed}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
          >
            {preTournamentRunning ? "Importing..." : "Import Pre-Tournament Data"}
          </button>

          <button
            onClick={previewPreTournament}
            disabled={!uid || preTournamentPreviewing}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
          >
            {preTournamentPreviewing ? "Previewing..." : "Preview Pre-Tournament"}
          </button>
        </div>

        {preTournamentPreview ? (
          <div className="text-sm text-slate-300">{preTournamentPreview}</div>
        ) : null}
        {preTournamentStatus ? (
          <div className="text-sm text-slate-300">{preTournamentStatus}</div>
        ) : null}
      </div>

      <div className="border-t border-slate-800/60 pt-4 space-y-3">
        <div className="text-sm font-semibold text-slate-100">
          Fixture Replay Shadow
        </div>
        <p className="text-xs text-slate-400">
          Replays fixture waves through the same validation pipeline into{" "}
          <code className="mx-1 text-emerald-200/90">shadowMatches</code>
          without touching public match docs.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="block text-sm text-slate-300">
            Wave size
            <input
              type="number"
              min="1"
              value={replayWaveSize}
              onChange={(e) => setReplayWaveSize(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <button
            onClick={runReplayWave}
            disabled={!uid || runningReplay || resettingReplay || !dangerConfirmed}
            className="px-4 py-2 rounded-xl bg-violet-500/90 text-violet-950 font-semibold disabled:opacity-50"
          >
            {runningReplay ? "Running Replay..." : "Run Replay Wave"}
          </button>
          <button
            onClick={resetReplayShadow}
            disabled={!uid || runningReplay || resettingReplay || !dangerConfirmed}
            className="px-4 py-2 rounded-xl border border-violet-400/50 bg-violet-500/10 text-violet-100 font-semibold disabled:opacity-50"
          >
            {resettingReplay ? "Resetting Replay..." : "Reset Replay Shadow"}
          </button>
        </div>
        <div className="text-sm text-slate-300">
          Cursor: {fixtureReplayState.cursor}
          {fixtureReplayState.total !== null && fixtureReplayState.total !== undefined
            ? ` / ${fixtureReplayState.total}`
            : ""}
          {" · "}Shadow matches: {fixtureReplayState.shadowMatchCount}
          {" · "}Done: {fixtureReplayState.done ? "yes" : "no"}
        </div>
        {replayStatus ? (
          <div className="text-sm text-slate-300">{replayStatus}</div>
        ) : null}
      </div>

      <div className="border-t border-slate-800/60 pt-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={recomputeLeaderboard}
            disabled={
              !uid || recomputing || retryingDirtyRecompute || recomputingShadow || !dangerConfirmed
            }
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 disabled:opacity-50"
          >
            {recomputing ? "Recomputing..." : "Recompute Leaderboard"}
          </button>
          <button
            onClick={recomputeShadowLeaderboard}
            disabled={
              !uid || recomputing || retryingDirtyRecompute || recomputingShadow || !dangerConfirmed
            }
            className="px-4 py-2 rounded-xl border border-violet-400/50 bg-violet-500/10 text-violet-100 disabled:opacity-50"
          >
            {recomputingShadow ? "Recomputing Shadow..." : "Recompute Shadow Leaderboard"}
          </button>
          <button
            onClick={retryDirtyLeaderboard}
            disabled={
              !uid || recomputing || retryingDirtyRecompute || recomputingShadow || !dangerConfirmed
            }
            className="px-4 py-2 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-100 disabled:opacity-50"
          >
            {retryingDirtyRecompute ? "Retrying Dirty Scores..." : "Retry Dirty Scores"}
          </button>
        </div>
        {recomputeStatus ? (
          <div className="text-sm text-slate-300">{recomputeStatus}</div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
        <div className="font-semibold mb-2 text-slate-100">Leaderboard Status</div>
        <div>
          Last updated:{" "}
          {leaderboardStatus.lastUpdated ? leaderboardStatus.lastUpdated : "—"}
        </div>
        <div>
          Scoring version:{" "}
          {leaderboardStatus.scoringVersion ? leaderboardStatus.scoringVersion : "—"}
        </div>
        <div>
          Include live:{" "}
          {typeof leaderboardStatus.includeLive === "boolean"
            ? String(leaderboardStatus.includeLive)
            : "—"}
        </div>
        <div className="mt-3 border-t border-slate-800/60 pt-3">
          <div className="font-semibold mb-2 text-slate-100">
            Shadow Leaderboard Status
          </div>
          <div>
            Last updated:{" "}
            {shadowLeaderboardStatus.lastUpdated
              ? shadowLeaderboardStatus.lastUpdated
              : "—"}
          </div>
          <div>
            Last attempt:{" "}
            {shadowLeaderboardStatus.lastAttemptAt
              ? shadowLeaderboardStatus.lastAttemptAt
              : "—"}
          </div>
          <div>
            Scoring version:{" "}
            {shadowLeaderboardStatus.scoringVersion
              ? shadowLeaderboardStatus.scoringVersion
              : "—"}
          </div>
          <div>
            Include live:{" "}
            {typeof shadowLeaderboardStatus.includeLive === "boolean"
              ? String(shadowLeaderboardStatus.includeLive)
              : "—"}
          </div>
          <div>
            Source collection:{" "}
            {shadowLeaderboardStatus.sourceCollection || "—"}
          </div>
          <div>Target: {shadowLeaderboardStatus.target || "—"}</div>
          <div>
            Row count:{" "}
            {typeof shadowLeaderboardStatus.rowCount === "number"
              ? shadowLeaderboardStatus.rowCount
              : "—"}
          </div>
          <div>Updated by: {shadowLeaderboardStatus.updatedBy || "—"}</div>
          <div>
            Last error:{" "}
            {shadowLeaderboardStatus.lastErrorAt
              ? shadowLeaderboardStatus.lastErrorAt
              : "—"}
          </div>
          {shadowLeaderboardStatus.lastErrorMessage ? (
            <div className="text-rose-300">
              Shadow recompute error: {shadowLeaderboardStatus.lastErrorMessage}
            </div>
          ) : null}
        </div>
        <div className="mt-3 border-t border-slate-800/60 pt-3">
          <div className="font-semibold mb-2 text-slate-100">
            Public vs Shadow Comparison
          </div>
          <div>Public rows: {leaderboardDiff.publicCount}</div>
          <div>Shadow rows: {leaderboardDiff.shadowCount}</div>
          <div>Detected mismatches: {leaderboardDiff.mismatchCount}</div>
          {leaderboardDiff.topMismatches.length > 0 ? (
            <div className="mt-2 space-y-1">
              {leaderboardDiff.topMismatches.map((row: {
                userId: string;
                displayName: string;
                publicRank: number | null;
                shadowRank: number | null;
                publicScore: number | null;
                shadowScore: number | null;
              }) => (
                <div
                  key={row.userId}
                  className="rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1"
                >
                  <div className="text-slate-100">{row.displayName}</div>
                  <div className="text-xs text-slate-400">
                    public r{row.publicRank ?? "—"} / s{row.publicScore ?? "—"}
                    {" · "}
                    shadow r{row.shadowRank ?? "—"} / s{row.shadowScore ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-emerald-300">
              No public-vs-shadow mismatch detected in the current rows.
            </div>
          )}
        </div>
        <div className="mt-3 border-t border-slate-800/60 pt-3">
          <div className="font-semibold mb-2 text-slate-100">
            Ingest / Recompute Health
          </div>
          <div>Match data updated: {ingestHealth.lastIngestSuccessAt ? "yes" : "no"}</div>
          <div>Leaderboard current: {ingestHealth.scoresDirty ? "no" : "yes"}</div>
          <div>Scores dirty: {ingestHealth.scoresDirty ? "yes" : "no"}</div>
          <div>Dirty reason: {ingestHealth.dirtyReason || "—"}</div>
          <div>Active provider: {ingestHealth.activeProvider || "—"}</div>
          <div>Mode: {ingestHealth.mode || "—"}</div>
          <div>Last ingest attempt: {ingestHealth.lastIngestAttemptAt || "—"}</div>
          <div>Last ingest success: {ingestHealth.lastIngestSuccessAt || "—"}</div>
          <div>Last ingest error: {ingestHealth.lastIngestErrorAt || "—"}</div>
          <div>Last recompute attempt: {ingestHealth.lastRecomputeAttemptAt || "—"}</div>
          <div>Last recompute: {ingestHealth.lastRecomputeSuccessAt || "—"}</div>
          <div>Last recompute error: {ingestHealth.lastRecomputeErrorAt || "—"}</div>
          {ingestHealth.lastIngestErrorMessage ? (
            <div className="text-rose-300">
              Ingest error: {ingestHealth.lastIngestErrorMessage}
            </div>
          ) : null}
          {ingestHealth.lastRecomputeErrorMessage ? (
            <div className="text-rose-300">
              Recompute error: {ingestHealth.lastRecomputeErrorMessage}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function FixtureIngestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
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
            <AdminEnvironmentBadge />
          </div>

          <AdminGate>{({ uid }) => <FixtureIngestContent uid={uid} />}</AdminGate>
        </div>
      </div>
    </div>
  );
}
