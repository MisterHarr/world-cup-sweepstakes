"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  asErrorMessage,
  DEFAULT_TRANSFER_WINDOW,
  fromLocalDateTimeInput,
  toIsoOrString,
  toLocalDateTimeInput,
  type TransferWindowState,
} from "@/lib/adminFixturesUtils";

interface TransferWindowPanelProps {
  uid: string;
  dangerConfirmed: boolean;
}

export function TransferWindowPanel({ uid, dangerConfirmed }: TransferWindowPanelProps) {
  const [transferWindow, setTransferWindow] = useState<TransferWindowState>(
    DEFAULT_TRANSFER_WINDOW
  );
  const [transferWindowEnabledInput, setTransferWindowEnabledInput] = useState(false);
  const [transferWindowStartsInput, setTransferWindowStartsInput] = useState("");
  const [transferWindowEndsInput, setTransferWindowEndsInput] = useState("");
  const [transferWindowStatus, setTransferWindowStatus] = useState("");
  const [savingTransferWindow, setSavingTransferWindow] = useState(false);

  useEffect(() => {
    if (!uid) {
      setTransferWindow(DEFAULT_TRANSFER_WINDOW);
      setTransferWindowEnabledInput(false);
      setTransferWindowStartsInput("");
      setTransferWindowEndsInput("");
      return;
    }

    const ref = doc(db, "settings", "transferWindow");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setTransferWindow(DEFAULT_TRANSFER_WINDOW);
        setTransferWindowEnabledInput(false);
        setTransferWindowStartsInput("");
        setTransferWindowEndsInput("");
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const startsAtIso = toIsoOrString(data.startsAt);
      const endsAtIso = toIsoOrString(data.endsAt);
      const nextState: TransferWindowState = {
        enabled: data.enabled === true,
        startsAtIso,
        endsAtIso,
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
        updatedAt: toIsoOrString(data.updatedAt),
      };

      setTransferWindow(nextState);
      setTransferWindowEnabledInput(nextState.enabled);
      setTransferWindowStartsInput(toLocalDateTimeInput(nextState.startsAtIso));
      setTransferWindowEndsInput(toLocalDateTimeInput(nextState.endsAtIso));
    });

    return () => unsub();
  }, [uid]);

  async function saveTransferWindow(options?: {
    enabled?: boolean;
    startsInput?: string;
    endsInput?: string;
  }) {
    setTransferWindowStatus("");
    if (!uid) {
      setTransferWindowStatus("❌ Not signed in.");
      return;
    }

    const enabledValue = options?.enabled ?? transferWindowEnabledInput;
    const startsInputValue = options?.startsInput ?? transferWindowStartsInput;
    const endsInputValue = options?.endsInput ?? transferWindowEndsInput;
    const startsAt = fromLocalDateTimeInput(startsInputValue);
    const endsAt = fromLocalDateTimeInput(endsInputValue);

    if (startsInputValue.trim() && !startsAt) {
      setTransferWindowStatus("❌ Invalid start time.");
      return;
    }
    if (endsInputValue.trim() && !endsAt) {
      setTransferWindowStatus("❌ Invalid end time.");
      return;
    }
    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      setTransferWindowStatus("❌ End time must be after start time.");
      return;
    }

    setSavingTransferWindow(true);
    setTransferWindowStatus("Saving transfer window...");

    try {
      await setDoc(
        doc(db, "settings", "transferWindow"),
        {
          enabled: enabledValue,
          startsAt: startsAt ?? null,
          endsAt: endsAt ?? null,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        },
        { merge: true }
      );
      setTransferWindowStatus(
        `✅ Transfer window ${enabledValue ? "enabled" : "disabled"}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setTransferWindowStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setSavingTransferWindow(false);
    }
  }

  async function closeTransferWindowNow() {
    setTransferWindowEnabledInput(false);
    setTransferWindowStartsInput("");
    setTransferWindowEndsInput("");
    await saveTransferWindow({ enabled: false, startsInput: "", endsInput: "" });
  }

  async function openTransferWindowNow() {
    setTransferWindowEnabledInput(true);
    setTransferWindowStartsInput("");
    setTransferWindowEndsInput("");
    await saveTransferWindow({ enabled: true, startsInput: "", endsInput: "" });
  }

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-100">Transfer Window</div>
          <div className="text-xs text-slate-400">
            Enable for transfer testing without console scripts.
          </div>
        </div>
        <div
          className={`text-xs font-semibold px-2 py-1 rounded-full border ${
            transferWindow.enabled
              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
              : "border-slate-700/70 bg-slate-900/70 text-slate-300"
          }`}
        >
          {transferWindow.enabled ? "OPEN" : "CLOSED"}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={transferWindowEnabledInput}
          onChange={(e) => setTransferWindowEnabledInput(e.target.checked)}
          className="h-4 w-4"
        />
        Enable transfer window
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm text-slate-300">
          Starts at (optional)
          <input
            type="datetime-local"
            value={transferWindowStartsInput}
            onChange={(e) => setTransferWindowStartsInput(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Ends at (optional)
          <input
            type="datetime-local"
            value={transferWindowEndsInput}
            onChange={(e) => setTransferWindowEndsInput(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={() => void openTransferWindowNow()}
          disabled={!uid || savingTransferWindow || !dangerConfirmed}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
        >
          Open Window Now
        </button>
        <button
          onClick={() => void saveTransferWindow()}
          disabled={!uid || savingTransferWindow || !dangerConfirmed}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
        >
          {savingTransferWindow ? "Saving..." : "Save Transfer Window"}
        </button>
        <button
          onClick={() => void closeTransferWindowNow()}
          disabled={!uid || savingTransferWindow || !dangerConfirmed}
          className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
        >
          Close Window Now
        </button>
      </div>

      {transferWindowStatus ? (
        <div className="text-sm text-slate-300">{transferWindowStatus}</div>
      ) : null}

      <div className="text-xs text-slate-400">
        Last update: {transferWindow.updatedAt || "—"}{" "}
        {transferWindow.updatedBy ? `• by ${transferWindow.updatedBy}` : ""}
      </div>
    </div>
  );
}
