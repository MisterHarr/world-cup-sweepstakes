"use client";

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import {
  asErrorMessage,
  asNonNegativeInt,
  type FixtureReplayState,
  type ReplayResult,
} from "@/lib/adminFixturesUtils";

interface ProviderShadowPanelProps {
  uid: string;
  dangerConfirmed: boolean;
}

export function ProviderShadowPanel({ uid, dangerConfirmed }: ProviderShadowPanelProps) {
  const [replayWaveSize, setReplayWaveSize] = useState("4");
  const [replayStatus, setReplayStatus] = useState("");
  const [runningReplay, setRunningReplay] = useState(false);
  const [resettingReplay, setResettingReplay] = useState(false);
  const [fixtureReplayState, setFixtureReplayState] = useState<FixtureReplayState>({
    cursor: 0,
    done: false,
    shadowMatchCount: 0,
  });

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
    setReplayStatus("Running next replay step...");

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
    setReplayStatus("Resetting replay...");

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

  return (
    <div className="border-t border-slate-800/60 pt-4 space-y-3">
      <div className="text-sm font-semibold text-slate-100">Replay Test</div>
      <p className="text-xs text-slate-400">
        Replays test match data step by step in a safe sandbox — no changes to public scores.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="block text-sm text-slate-300">
          Matches per step
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
          {runningReplay ? "Running..." : "Run Next Step"}
        </button>
        <button
          onClick={resetReplayShadow}
          disabled={!uid || runningReplay || resettingReplay || !dangerConfirmed}
          className="px-4 py-2 rounded-xl border border-violet-400/50 bg-violet-500/10 text-violet-100 font-semibold disabled:opacity-50"
        >
          {resettingReplay ? "Resetting..." : "Reset Replay"}
        </button>
      </div>
      <div className="text-sm text-slate-300">
        Progress: {fixtureReplayState.cursor}
        {fixtureReplayState.total !== null && fixtureReplayState.total !== undefined
          ? ` / ${fixtureReplayState.total}`
          : ""}
        {" · "}Test matches: {fixtureReplayState.shadowMatchCount}
        {" · "}Done: {fixtureReplayState.done ? "yes" : "no"}
      </div>
      {replayStatus ? (
        <div className="text-sm text-slate-300">{replayStatus}</div>
      ) : null}
    </div>
  );
}
