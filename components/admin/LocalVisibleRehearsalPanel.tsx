"use client";

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import {
  asErrorMessage,
  toIsoOrString,
  type LiveSimulatorResult,
  type LiveSimulatorState,
  type PublicRehearsalResetPreview,
  type PublicRehearsalResetResult,
} from "@/lib/adminFixturesUtils";

interface LocalVisibleRehearsalPanelProps {
  uid: string;
  dangerConfirmed: boolean;
}

export function LocalVisibleRehearsalPanel({
  uid,
  dangerConfirmed,
}: LocalVisibleRehearsalPanelProps) {
  const [liveSimulatorState, setLiveSimulatorState] = useState<LiveSimulatorState>({
    nextWave: 0,
    totalWaves: 4,
    done: false,
  });
  const [resettingPublicRehearsal, setResettingPublicRehearsal] = useState(false);
  const [previewingPublicRehearsalReset, setPreviewingPublicRehearsalReset] =
    useState(false);
  const [publicRehearsalStatus, setPublicRehearsalStatus] = useState("");
  const [runningLiveSimulatorWave, setRunningLiveSimulatorWave] = useState(false);
  const [liveSimulatorStatus, setLiveSimulatorStatus] = useState("");

  useEffect(() => {
    if (!uid) {
      setLiveSimulatorState({ nextWave: 0, totalWaves: 4, done: false });
      return;
    }

    const ref = doc(db, "settings", "liveSimulator");
    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
      setLiveSimulatorState({
        nextWave:
          typeof data.nextWave === "number" && Number.isFinite(data.nextWave)
            ? Math.max(0, Math.floor(data.nextWave))
            : 0,
        totalWaves:
          typeof data.totalWaves === "number" && Number.isFinite(data.totalWaves)
            ? Math.max(1, Math.floor(data.totalWaves))
            : 4,
        lastAppliedWave:
          typeof data.lastAppliedWave === "number" &&
          Number.isFinite(data.lastAppliedWave)
            ? Math.max(0, Math.floor(data.lastAppliedWave))
            : null,
        lastLabel:
          typeof data.lastLabel === "string" && data.lastLabel.trim().length > 0
            ? data.lastLabel
            : null,
        done: data.done === true,
        updatedAt: toIsoOrString(data.updatedAt),
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
      });
    });

    return () => unsub();
  }, [uid]);

  async function previewPublicRehearsalReset() {
    setPublicRehearsalStatus("");
    if (!uid) {
      setPublicRehearsalStatus("❌ Not signed in.");
      return;
    }

    setPreviewingPublicRehearsalReset(true);
    try {
      const fn = httpsCallable<{ dryRun: true }, PublicRehearsalResetPreview>(
        functions,
        "adminResetPublicRehearsalState"
      );
      const res = await fn({ dryRun: true });
      const data = res.data;
      setPublicRehearsalStatus(
        `Preview: delete ${data.willDeleteMatches ?? 0} public match(es), delete ${data.willDeleteTransferEvents ?? 0} transfer event(s), reset ${data.willResetUsers ?? 0} user score(s), reset ${data.willResetTeams ?? 0} team stat row(s).`
      );
    } catch (err: unknown) {
      console.error(err);
      setPublicRehearsalStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setPreviewingPublicRehearsalReset(false);
    }
  }

  async function resetPublicRehearsalState() {
    setPublicRehearsalStatus("");
    if (!uid) {
      setPublicRehearsalStatus("❌ Not signed in.");
      return;
    }

    const summary = [
      "Reset visible rehearsal state?",
      "- Users and entries stay.",
      "- Public matches and transfer events are deleted.",
      "- Team stats and user scores return to zero.",
      "- Public leaderboard/current is deleted.",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setPublicRehearsalStatus("Cancelled.");
      return;
    }

    setResettingPublicRehearsal(true);
    setPublicRehearsalStatus("Resetting visible rehearsal state...");
    try {
      const fn = httpsCallable<Record<string, never>, PublicRehearsalResetResult>(
        functions,
        "adminResetPublicRehearsalState"
      );
      const res = await fn({});
      const data = res.data;
      setPublicRehearsalStatus(
        `✅ Reset complete. Deleted ${data.deletedMatches ?? 0} match(es) and ${data.deletedTransferEvents ?? 0} transfer event(s). Reset ${data.resetUsers ?? 0} user score(s) and ${data.resetTeams ?? 0} team stat row(s).`
      );
    } catch (err: unknown) {
      console.error(err);
      setPublicRehearsalStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setResettingPublicRehearsal(false);
    }
  }

  async function runLiveSimulatorWave() {
    setLiveSimulatorStatus("");
    if (!uid) {
      setLiveSimulatorStatus("❌ Not signed in.");
      return;
    }

    setRunningLiveSimulatorWave(true);
    setLiveSimulatorStatus("Running next visible live wave...");
    try {
      const fn = httpsCallable<Record<string, never>, LiveSimulatorResult>(
        functions,
        "adminRunLocalLiveSimulatorWave"
      );
      const res = await fn({});
      const data = res.data;
      const label = data.label ? ` (${data.label})` : "";
      setLiveSimulatorStatus(
        `✅ Wave ${(data.waveIndex ?? 0) + 1}/${data.totalWaves ?? 4}${label}: processed ${data.matches ?? 0}, updated ${data.updated ?? 0}, quarantined ${data.quarantined ?? 0}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setLiveSimulatorStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRunningLiveSimulatorWave(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-slate-200 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-100">
            Local Visible Rehearsal
          </div>
          <div className="text-xs text-emerald-100/80">
            Public localhost matches only. Users and entries stay.
          </div>
        </div>
        <div className="text-xs font-semibold px-2 py-1 rounded-full border border-emerald-400/50 bg-emerald-400/15 text-emerald-100">
          Wave{" "}
          {Math.min(
            liveSimulatorState.nextWave + 1,
            liveSimulatorState.totalWaves
          )}
          /{liveSimulatorState.totalWaves}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={previewPublicRehearsalReset}
          disabled={
            !uid || previewingPublicRehearsalReset || resettingPublicRehearsal
          }
          className="px-4 py-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 text-emerald-100 font-semibold disabled:opacity-50"
        >
          {previewingPublicRehearsalReset ? "Previewing..." : "Preview Reset"}
        </button>
        <button
          onClick={resetPublicRehearsalState}
          disabled={
            !uid ||
            resettingPublicRehearsal ||
            runningLiveSimulatorWave ||
            !dangerConfirmed
          }
          className="px-4 py-2 rounded-xl bg-amber-500/90 text-amber-950 font-semibold disabled:opacity-50"
        >
          {resettingPublicRehearsal ? "Resetting..." : "Reset Visible Data"}
        </button>
        <button
          onClick={runLiveSimulatorWave}
          disabled={
            !uid ||
            runningLiveSimulatorWave ||
            resettingPublicRehearsal ||
            !dangerConfirmed
          }
          className="px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
        >
          {runningLiveSimulatorWave ? "Running Wave..." : "Run Next Live Wave"}
        </button>
        <div className="rounded-lg border border-emerald-400/20 bg-slate-950/40 px-3 py-2 text-xs text-emerald-50/90">
          Last:{" "}
          {liveSimulatorState.lastLabel
            ? `${liveSimulatorState.lastLabel}`
            : "none"}
          {liveSimulatorState.updatedAt
            ? ` • ${liveSimulatorState.updatedAt}`
            : ""}
        </div>
      </div>

      {publicRehearsalStatus ? (
        <div className="text-sm text-slate-200">{publicRehearsalStatus}</div>
      ) : null}
      {liveSimulatorStatus ? (
        <div className="text-sm text-slate-200">{liveSimulatorStatus}</div>
      ) : null}
    </div>
  );
}
