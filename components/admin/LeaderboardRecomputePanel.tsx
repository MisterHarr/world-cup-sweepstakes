"use client";

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import {
  asErrorMessage,
  readLeaderboardRows,
  toIsoOrString,
  type IngestHealthState,
  type LeaderboardStatus,
  type RecomputeResult,
  type ShadowLeaderboardStatus,
} from "@/lib/adminFixturesUtils";

interface LeaderboardRecomputePanelProps {
  uid: string;
  dangerConfirmed: boolean;
}

export function LeaderboardRecomputePanel({
  uid,
  dangerConfirmed,
}: LeaderboardRecomputePanelProps) {
  const [recomputeStatus, setRecomputeStatus] = useState("");
  const [recomputing, setRecomputing] = useState(false);
  const [retryingDirtyRecompute, setRetryingDirtyRecompute] = useState(false);
  const [recomputingShadow, setRecomputingShadow] = useState(false);
  const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>({});
  const [shadowLeaderboardStatus, setShadowLeaderboardStatus] =
    useState<ShadowLeaderboardStatus>({});
  const [ingestHealth, setIngestHealth] = useState<IngestHealthState>({
    scoresDirty: false,
  });

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
          typeof data.sourceCollection === "string" ? data.sourceCollection : undefined,
        target: typeof data.target === "string" ? data.target : undefined,
        lastErrorAt: toIsoOrString(data.lastErrorAt),
        lastErrorMessage:
          typeof data.lastErrorMessage === "string" ? data.lastErrorMessage : undefined,
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
        dirtyReason: typeof data.dirtyReason === "string" ? data.dirtyReason : null,
        activeProvider:
          typeof data.activeProvider === "string" ? data.activeProvider : "",
        mode: typeof data.mode === "string" ? data.mode : null,
      });
    });

    return () => unsub();
  }, [uid]);

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

  async function recomputeLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }

    setRecomputing(true);
    setRecomputeStatus("Refreshing scores...");

    try {
      const fn = httpsCallable<Record<string, never>, RecomputeResult>(
        functions,
        "recomputeScores"
      );
      const res = await fn({});
      const data = res.data;
      setRecomputeStatus(
        `✅ Scores refreshed for ${data?.users ?? 0} players (${data?.matches ?? 0} matches).`
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
    setRecomputeStatus("Force refreshing scores...");

    try {
      const fn = httpsCallable<Record<string, never>, RecomputeResult>(
        functions,
        "retryDirtyRecompute"
      );
      const res = await fn({});
      const data = res.data;
      setRecomputeStatus(
        data?.wasDirty
          ? `✅ Scores refreshed for ${data?.users ?? 0} players (${data?.matches ?? 0} matches).`
          : `✅ Scores were already up to date — nothing to do.`
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
    setRecomputeStatus("Refreshing test scores...");

    try {
      const fn = httpsCallable<Record<string, never>, RecomputeResult>(
        functions,
        "recomputeShadowScores"
      );
      const res = await fn({});
      const data = res.data;
      setRecomputeStatus(
        `✅ Test scores refreshed for ${data?.users ?? 0} players (${data?.matches ?? 0} matches).`
      );
    } catch (err: unknown) {
      console.error(err);
      setRecomputeStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRecomputingShadow(false);
    }
  }

  return (
    <>
      <div className="border-t border-slate-800/60 pt-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={recomputeLeaderboard}
            disabled={
              !uid ||
              recomputing ||
              retryingDirtyRecompute ||
              recomputingShadow ||
              !dangerConfirmed
            }
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 disabled:opacity-50"
          >
            {recomputing ? "Refreshing..." : "Refresh Scores"}
          </button>
          <button
            onClick={recomputeShadowLeaderboard}
            disabled={
              !uid ||
              recomputing ||
              retryingDirtyRecompute ||
              recomputingShadow ||
              !dangerConfirmed
            }
            className="px-4 py-2 rounded-xl border border-violet-400/50 bg-violet-500/10 text-violet-100 disabled:opacity-50"
          >
            {recomputingShadow ? "Refreshing..." : "Refresh Test Scores"}
          </button>
          <button
            onClick={retryDirtyLeaderboard}
            disabled={
              !uid ||
              recomputing ||
              retryingDirtyRecompute ||
              recomputingShadow ||
              !dangerConfirmed
            }
            className="px-4 py-2 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-100 disabled:opacity-50"
          >
            {retryingDirtyRecompute ? "Refreshing..." : "Force Refresh"}
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
          <div className="font-semibold mb-2 text-slate-100">Test Leaderboard Status</div>
          <div>
            Last updated:{" "}
            {shadowLeaderboardStatus.lastUpdated ? shadowLeaderboardStatus.lastUpdated : "—"}
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
          <div>Source collection: {shadowLeaderboardStatus.sourceCollection || "—"}</div>
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
            {shadowLeaderboardStatus.lastErrorAt ? shadowLeaderboardStatus.lastErrorAt : "—"}
          </div>
          {shadowLeaderboardStatus.lastErrorMessage ? (
            <div className="text-rose-300">
              Test score error: {shadowLeaderboardStatus.lastErrorMessage}
            </div>
          ) : null}
        </div>
        <div className="mt-3 border-t border-slate-800/60 pt-3">
          <div className="font-semibold mb-2 text-slate-100">
            Live vs Test Comparison
          </div>
          <div>Live rows: {leaderboardDiff.publicCount}</div>
          <div>Test rows: {leaderboardDiff.shadowCount}</div>
          <div>Differences: {leaderboardDiff.mismatchCount}</div>
          {leaderboardDiff.topMismatches.length > 0 ? (
            <div className="mt-2 space-y-1">
              {leaderboardDiff.topMismatches.map((row) => (
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
              Live and test scores match — no differences found.
            </div>
          )}
        </div>
        <div className="mt-3 border-t border-slate-800/60 pt-3">
          <div className="font-semibold mb-2 text-slate-100">
            System Health
          </div>
          <div>Match data up to date: {ingestHealth.lastIngestSuccessAt ? "yes" : "no"}</div>
          <div>Scores up to date: {ingestHealth.scoresDirty ? "no" : "yes"}</div>
          {ingestHealth.scoresDirty ? <div>Reason: {ingestHealth.dirtyReason || "—"}</div> : null}
          <div>Data source: {ingestHealth.activeProvider || "—"}</div>
          <div>Mode: {ingestHealth.mode || "—"}</div>
          <div>Last data fetch: {ingestHealth.lastIngestSuccessAt || "—"}</div>
          <div>Last data fetch attempt: {ingestHealth.lastIngestAttemptAt || "—"}</div>
          <div>Last data fetch error: {ingestHealth.lastIngestErrorAt || "—"}</div>
          <div>Last score refresh: {ingestHealth.lastRecomputeSuccessAt || "—"}</div>
          <div>Last score refresh attempt: {ingestHealth.lastRecomputeAttemptAt || "—"}</div>
          <div>Last score refresh error: {ingestHealth.lastRecomputeErrorAt || "—"}</div>
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
