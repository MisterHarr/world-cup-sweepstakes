"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  Coins,
  LockOpen,
  Lock,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { collection, doc, onSnapshot, query, setDoc, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminEnvironmentBadge } from "@/components/admin/AdminEnvironmentBadge";
import { db, functions } from "@/lib/firebase";
import { PRIZE_POT_CONFIG } from "@/lib/prizePot";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PotEntry {
  uid: string;
  displayName: string;
  code?: string;
  selfDeclaredAt?: { seconds: number } | null;
  status: "pending" | "confirmed";
  amount?: number;
  currency?: string;
  confirmedAt?: { seconds: number } | null;
  note?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() / 1000) - ts.seconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatAmount(amount: number | undefined, currency: string | undefined): string {
  const c = currency ?? PRIZE_POT_CONFIG.currency;
  const a = amount ?? PRIZE_POT_CONFIG.amountPerEntry;
  return `${c} ${a.toFixed(0)}`;
}

// ── Panel (rendered inside AdminGate) ─────────────────────────────────────────

function PotPanel({ uid }: { uid: string }) {
  const [entries, setEntries] = useState<PotEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  // null = still loading
  const [potLocked, setPotLocked] = useState<boolean | null>(null);
  const [entryDeadline, setEntryDeadline] = useState<{ seconds: number } | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [deadlineBusy, setDeadlineBusy] = useState(false);

  // Derived: are entries currently open?
  const potOpen: boolean | null =
    potLocked === null
      ? null
      : !potLocked &&
        (entryDeadline === null || Date.now() / 1000 < entryDeadline.seconds);

  // ── Live listener: entries ───────────────────────────────────────────────

  useEffect(() => {
    const q = query(collection(db, "potEntries"));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => d.data() as PotEntry));
    });
    return () => unsub();
  }, []);

  // ── Live listener: pot settings ──────────────────────────────────────────

  useEffect(() => {
    const ref = doc(db, "settings", "prizePot");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setPotLocked(false);
        setEntryDeadline(null);
        return;
      }
      const data = snap.data() as {
        potLocked?: boolean;
        open?: boolean;
        entryDeadline?: { seconds: number } | null;
      };
      // potLocked is the authoritative lock; fall back to !open for back-compat
      setPotLocked(data.potLocked === true || data.open === false);
      setEntryDeadline(data.entryDeadline ?? null);

      // Populate the deadline input with the stored value (only when it hasn't
      // been edited by the admin this session — use a one-time seed on first load)
      if (data.entryDeadline) {
        const d = new Date(data.entryDeadline.seconds * 1000);
        // datetime-local requires YYYY-MM-DDTHH:MM with no seconds
        const pad = (n: number) => String(n).padStart(2, "0");
        const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setDeadlineInput((prev) => prev || local);
      }
    }, () => { setPotLocked(false); setEntryDeadline(null); });
    return () => unsub();
  }, []);

  async function togglePotOpen() {
    if (toggleBusy || potLocked === null) return;
    setToggleBusy(true);
    try {
      const nowLocked = !potLocked;
      // Write both potLocked (new) and open (legacy) so all clients stay in sync
      await setDoc(
        doc(db, "settings", "prizePot"),
        { potLocked: nowLocked, open: !nowLocked },
        { merge: true }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus(`❌ ${msg}`);
    } finally {
      setToggleBusy(false);
    }
  }

  async function savePotDeadline(clear = false) {
    if (deadlineBusy) return;
    setDeadlineBusy(true);
    try {
      if (clear) {
        await setDoc(
          doc(db, "settings", "prizePot"),
          { entryDeadline: null },
          { merge: true }
        );
        setDeadlineInput("");
      } else {
        if (!deadlineInput) return;
        const ts = Timestamp.fromDate(new Date(deadlineInput));
        await setDoc(
          doc(db, "settings", "prizePot"),
          { entryDeadline: ts },
          { merge: true }
        );
      }
      setStatus(clear ? "Deadline cleared." : "Deadline saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus(`❌ ${msg}`);
    } finally {
      setDeadlineBusy(false);
    }
  }

  const pending = entries.filter((e) => e.status === "pending");
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const potTotal = confirmed.length * PRIZE_POT_CONFIG.amountPerEntry;

  // ── Confirm single entry ─────────────────────────────────────────────────

  const confirmEntry = useCallback(async (entryUid: string) => {
    setBusy((prev) => new Set(prev).add(entryUid));
    setStatus("");
    try {
      const fn = httpsCallable(functions, "confirmPotEntry");
      await fn({
        uid: entryUid,
        amount: PRIZE_POT_CONFIG.amountPerEntry,
        currency: PRIZE_POT_CONFIG.currency,
      });
      setSelected((prev) => { const s = new Set(prev); s.delete(entryUid); return s; });
      setStatus(`✅ Confirmed.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus(`❌ ${msg}`);
    } finally {
      setBusy((prev) => { const s = new Set(prev); s.delete(entryUid); return s; });
    }
  }, []);

  // ── Confirm all selected ─────────────────────────────────────────────────

  async function confirmSelected() {
    if (selected.size === 0 || batchBusy) return;
    setBatchBusy(true);
    setStatus(`Confirming ${selected.size} entries…`);
    const uids = Array.from(selected);
    const fn = httpsCallable(functions, "confirmPotEntry");
    const results = await Promise.allSettled(
      uids.map((u) =>
        fn({ uid: u, amount: PRIZE_POT_CONFIG.amountPerEntry, currency: PRIZE_POT_CONFIG.currency })
      )
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelected(new Set());
    setBatchBusy(false);
    setStatus(
      failed === 0
        ? `✅ All ${uids.length} confirmed.`
        : `⚠️ ${uids.length - failed} confirmed, ${failed} failed — check console.`
    );
  }

  // ── Confirm all pending ──────────────────────────────────────────────────

  async function confirmAll() {
    const all = pending.map((e) => e.uid);
    if (all.length === 0 || batchBusy) return;
    setBatchBusy(true);
    setStatus(`Confirming all ${all.length} pending entries…`);
    const fn = httpsCallable(functions, "confirmPotEntry");
    const results = await Promise.allSettled(
      all.map((u) =>
        fn({ uid: u, amount: PRIZE_POT_CONFIG.amountPerEntry, currency: PRIZE_POT_CONFIG.currency })
      )
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    setSelected(new Set());
    setBatchBusy(false);
    setStatus(
      failed === 0
        ? `✅ All ${all.length} confirmed.`
        : `⚠️ ${all.length - failed} confirmed, ${failed} failed.`
    );
  }

  // ── Remove entry ─────────────────────────────────────────────────────────

  async function removeEntry(entryUid: string, displayName: string) {
    if (!window.confirm(`Remove ${displayName}'s entry? This cannot be undone.`)) return;
    setBusy((prev) => new Set(prev).add(entryUid));
    setStatus("");
    try {
      const fn = httpsCallable(functions, "removePotEntry");
      await fn({ uid: entryUid });
      setSelected((prev) => { const s = new Set(prev); s.delete(entryUid); return s; });
      setStatus(`🗑 ${displayName}'s entry removed.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus(`❌ ${msg}`);
    } finally {
      setBusy((prev) => { const s = new Set(prev); s.delete(entryUid); return s; });
    }
  }

  // ── Selection helpers ────────────────────────────────────────────────────

  function toggleSelect(entryUid: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(entryUid) ? s.delete(entryUid) : s.add(entryUid);
      return s;
    });
  }

  function selectAll() {
    setSelected(new Set(pending.map((e) => e.uid)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ── Export confirmed entrants ────────────────────────────────────────────

  async function handleExport() {
    if (exportBusy) return;
    setExportBusy(true);
    setExportText(null);
    try {
      const fn = httpsCallable<Record<string, never>, {
        ok: boolean;
        count: number;
        rows: Array<{ uid: string; displayName: string; code: string | null; amount: number | null; currency: string | null; confirmedAt: number | null }>;
      }>(functions, "exportConfirmedEntrants");
      const res = await fn({});
      const { count, rows } = res.data;
      const lines = [
        `Confirmed entrants — snapshot ${new Date().toLocaleString()} (${count} total)`,
        "",
        ...rows.map((r, i) => {
          const date = r.confirmedAt
            ? new Date(r.confirmedAt * 1000).toLocaleDateString()
            : "—";
          return `${i + 1}. ${r.displayName}  code:${r.code ?? "—"}  ${r.currency ?? "RM"} ${r.amount ?? "?"}  confirmed:${date}`;
        }),
      ];
      setExportText(lines.join("\n"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setExportText(`❌ ${msg}`);
    } finally {
      setExportBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Summary strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
          <div className="text-2xl font-black text-amber-300">{pending.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Pending</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
          <div className="text-2xl font-black text-emerald-300">{confirmed.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">Confirmed</div>
        </div>
        <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-center">
          <div className="text-2xl font-black text-yellow-300">
            {PRIZE_POT_CONFIG.currency}{potTotal}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Pot total</div>
        </div>
      </div>

      {/* ── Entry window controls ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/70 overflow-hidden">

        {/* Lock toggle row */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            {potOpen === null ? null : potOpen ? (
              <LockOpen className="size-4 text-emerald-400 shrink-0" aria-hidden />
            ) : (
              <Lock className="size-4 text-rose-400 shrink-0" aria-hidden />
            )}
            <div>
              <span className="text-sm font-semibold text-slate-100">
                Entries are {potOpen === null ? "…" : potOpen ? "open" : "closed"}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                {potLocked
                  ? "Locked — QR hidden. Rules enforce this; no new entries possible."
                  : potOpen === false
                  ? "Past deadline — entries auto-closed."
                  : "Players can see the QR and enter."}
              </p>
            </div>
          </div>
          <button
            onClick={() => void togglePotOpen()}
            disabled={toggleBusy || potLocked === null}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
              potLocked
                ? "bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400"
                : "bg-rose-500/90 text-rose-950 hover:bg-rose-400"
            }`}
          >
            {toggleBusy ? "Saving…" : potLocked ? "Unlock entries" : "Lock entries"}
          </button>
        </div>

        {/* Deadline row */}
        <div className="border-t border-slate-800/60 px-4 py-3 space-y-2">
          <p className="text-xs text-slate-400">
            Auto-close deadline — entries stop at this date/time even if not manually locked.
            {entryDeadline ? (
              <span className="ml-1 text-amber-300 font-semibold">
                Set: {new Date(entryDeadline.seconds * 1000).toLocaleString()}
              </span>
            ) : (
              <span className="ml-1 text-slate-500"> None set.</span>
            )}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-50"
              disabled={deadlineBusy}
            />
            <button
              onClick={() => void savePotDeadline(false)}
              disabled={deadlineBusy || !deadlineInput}
              className="rounded-xl bg-amber-500/90 px-3 py-1.5 text-sm font-semibold text-amber-950 disabled:opacity-50 hover:bg-amber-400"
            >
              {deadlineBusy ? "Saving…" : "Set deadline"}
            </button>
            {entryDeadline ? (
              <button
                onClick={() => void savePotDeadline(true)}
                disabled={deadlineBusy}
                className="rounded-xl border border-slate-700/60 px-3 py-1.5 text-sm text-slate-400 disabled:opacity-50 hover:text-slate-200"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

      </div>

      {/* ── Status message ─────────────────────────────────────────── */}
      {status ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
          <span>{status}</span>
          <button onClick={() => setStatus("")} className="text-slate-500 hover:text-slate-300">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* ── Pending entries ────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/70 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-amber-400 shrink-0" aria-hidden />
            <span className="font-semibold text-slate-100 text-sm">
              Pending{pending.length > 0 ? ` (${pending.length})` : ""}
            </span>
          </div>
          {pending.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-800/60"
              >
                Select all
              </button>
              <button
                onClick={() => void confirmAll()}
                disabled={batchBusy}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-emerald-950 disabled:opacity-50 hover:bg-emerald-400"
              >
                <CheckCircle2 className="size-3.5" aria-hidden />
                Confirm all
              </button>
            </div>
          ) : null}
        </div>

        {/* Sticky batch bar — appears when items selected */}
        {selected.size > 0 ? (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-emerald-950/60 border-b border-emerald-800/40">
            <span className="text-sm text-emerald-300 font-semibold">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={clearSelection}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg"
              >
                Clear
              </button>
              <button
                onClick={() => void confirmSelected()}
                disabled={batchBusy}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 disabled:opacity-50 hover:bg-emerald-400"
              >
                <CheckCircle2 className="size-3.5" aria-hidden />
                Confirm {selected.size}
              </button>
            </div>
          </div>
        ) : null}

        {pending.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No pending entries — all clear.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {pending.map((entry) => {
              const isBusy = busy.has(entry.uid);
              const isChecked = selected.has(entry.uid);
              return (
                <li
                  key={entry.uid}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isChecked ? "bg-emerald-950/30" : "hover:bg-slate-800/40"
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelect(entry.uid)}
                    className="h-4 w-4 shrink-0 accent-emerald-500"
                    aria-label={`Select ${entry.displayName}`}
                  />

                  {/* Name + code */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-100 text-sm">
                        {entry.displayName}
                      </span>
                      {entry.code ? (
                        <span className="font-mono text-xs font-bold tracking-widest text-amber-300 bg-amber-950/50 border border-amber-800/40 rounded px-1.5 py-0.5">
                          {entry.code}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Declared {relativeTime(entry.selfDeclaredAt)}
                    </div>
                  </div>

                  {/* Amount */}
                  <span className="text-xs font-semibold text-slate-300 shrink-0">
                    {formatAmount(entry.amount, entry.currency)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => void confirmEntry(entry.uid)}
                      disabled={isBusy}
                      title="Confirm payment"
                      className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/90 text-emerald-950 disabled:opacity-50 hover:bg-emerald-400 transition-colors"
                    >
                      {isBusy
                        ? <RefreshCw className="size-3.5 animate-spin" aria-hidden />
                        : <CheckCircle2 className="size-4" aria-hidden />
                      }
                    </button>
                    <button
                      onClick={() => void removeEntry(entry.uid, entry.displayName)}
                      disabled={isBusy}
                      title="Remove entry"
                      className="flex size-8 items-center justify-center rounded-lg border border-slate-700/60 text-slate-500 disabled:opacity-50 hover:border-rose-500/60 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Confirmed entries ──────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/70 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" aria-hidden />
          <span className="font-semibold text-slate-100 text-sm">
            Confirmed{confirmed.length > 0 ? ` (${confirmed.length})` : ""}
          </span>
          <span className="ml-auto text-xs font-semibold text-yellow-300">
            {PRIZE_POT_CONFIG.currency} {potTotal} total
          </span>
        </div>

        {confirmed.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No confirmed entries yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {confirmed.map((entry) => (
              <li
                key={entry.uid}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors"
              >
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-100 text-sm">
                    {entry.displayName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Confirmed {relativeTime(entry.confirmedAt)}
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-300 shrink-0">
                  {formatAmount(entry.amount, entry.currency)}
                </span>
                <button
                  onClick={() => void removeEntry(entry.uid, entry.displayName)}
                  title="Remove entry"
                  className="flex size-8 items-center justify-center rounded-lg border border-slate-700/60 text-slate-600 hover:border-rose-500/60 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Export confirmed entrants ──────────────────────────── */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/70 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/60">
          <div>
            <span className="font-semibold text-slate-100 text-sm">Payout list</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Snapshot of confirmed entrants — save this before the tournament starts.
            </p>
          </div>
          <button
            onClick={() => void handleExport()}
            disabled={exportBusy}
            className="shrink-0 rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50 hover:bg-slate-800/60"
          >
            {exportBusy ? "Loading…" : "Export"}
          </button>
        </div>
        {exportText ? (
          <pre className="px-4 py-3 text-xs text-slate-300 whitespace-pre-wrap font-mono overflow-x-auto max-h-64 overflow-y-auto">
            {exportText}
          </pre>
        ) : null}
      </div>

      <div className="text-xs text-slate-600 text-center pb-2">
        Signed in as {uid} · Changes are live instantly
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPotPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">

        {/* Header */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Coins className="size-5 text-yellow-400" aria-hidden />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Prize Pot</h1>
                <span className="text-xs uppercase tracking-widest text-slate-400">
                  Admin · Confirmation Panel
                </span>
              </div>
            </div>
            <AdminEnvironmentBadge />
          </div>

          <div className="mt-1">
            <a
              href="/admin"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Back to Admin
            </a>
          </div>
        </div>

        {/* Gate */}
        <AdminGate>
          {({ uid }) => <PotPanel uid={uid} />}
        </AdminGate>

      </div>
    </div>
  );
}
