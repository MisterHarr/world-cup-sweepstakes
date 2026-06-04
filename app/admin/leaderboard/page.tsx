"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { Copy, Check } from "lucide-react";
import { db } from "@/lib/firebase";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell, AdminSectionLabel } from "@/components/admin/AdminShell";
import { readLeaderboardRows, type LeaderboardRowStatus } from "@/lib/adminFixturesUtils";

// ── Types ──────────────────────────────────────────────────────────────────────

type PotStatus = "paid" | "opted_out" | "pending";

interface UserPotRecord {
  uid: string;
  displayName: string;
  potStatus: PotStatus;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

function scoreLabel(n: number): string {
  return `${n} pt${n === 1 ? "" : "s"}`;
}

function rowsToText(rows: Array<{ rank: number; displayName: string; totalScore: number }>): string {
  return rows
    .map((r) => `${medal(r.rank)} ${r.displayName} — ${scoreLabel(r.totalScore)}`)
    .join("\n");
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-lg border border-slate-700/60 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
    >
      {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ── Leaderboard table ──────────────────────────────────────────────────────────

function LeaderboardTable({
  rows,
  highlightUid,
  emptyMessage = "No entries yet.",
}: {
  rows: Array<LeaderboardRowStatus & { potStatus?: PotStatus }>;
  highlightUid?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-500">{emptyMessage}</div>
    );
  }
  return (
    <ul className="divide-y divide-slate-800/50">
      {rows.map((row) => (
        <li
          key={row.userId}
          className={`flex items-center gap-3 px-4 py-2.5 ${
            row.userId === highlightUid ? "bg-sky-950/30" : ""
          }`}
        >
          <span className="w-8 shrink-0 text-sm font-bold text-slate-400 tabular-nums">
            {medal(row.rank)}
          </span>
          <span className="flex-1 min-w-0 text-sm font-medium text-slate-100 truncate">
            {row.displayName}
          </span>
          <span className="text-xs font-semibold text-slate-300 shrink-0 tabular-nums">
            {scoreLabel(row.totalScore)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

function LeaderboardContent() {
  const [allRows, setAllRows] = useState<LeaderboardRowStatus[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [userPotRecords, setUserPotRecords] = useState<UserPotRecord[]>([]);

  // Live listener: public leaderboard
  useEffect(() => {
    const ref = doc(db, "leaderboard", "current");
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setAllRows([]); return; }
      const data = snap.data() as Record<string, unknown>;
      setAllRows(readLeaderboardRows(data));
      if (typeof data.lastUpdated === "string") setLastUpdated(data.lastUpdated);
    });
  }, []);

  // Live listener: users collection for pot payment status
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("displayName"));
    return onSnapshot(q, (snap) => {
      setUserPotRecords(
        snap.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            if (data.isMock === true) return null;
            const raw = data.potPaymentStatus;
            const potStatus: PotStatus =
              raw === "paid" ? "paid" : raw === "opted_out" ? "opted_out" : "pending";
            return {
              uid: d.id,
              displayName: typeof data.displayName === "string" ? data.displayName : d.id,
              potStatus,
            };
          })
          .filter((r): r is UserPotRecord => r !== null)
      );
    });
  }, []);

  // Derived data
  const potStatusByUid = useMemo(
    () => new Map(userPotRecords.map((u) => [u.uid, u.potStatus])),
    [userPotRecords]
  );

  const overallRows = useMemo(
    () => [...allRows].sort((a, b) => a.rank - b.rank),
    [allRows]
  );

  const potRows = useMemo(() => {
    const paid = allRows.filter((r) => potStatusByUid.get(r.userId) === "paid");
    paid.sort((a, b) => b.totalScore - a.totalScore || a.displayName.localeCompare(b.displayName));
    return paid.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [allRows, potStatusByUid]);

  const optedOutRows = useMemo(
    () => allRows.filter((r) => potStatusByUid.get(r.userId) === "opted_out"),
    [allRows, potStatusByUid]
  );

  const pendingRows = useMemo(
    () => allRows.filter((r) => {
      const s = potStatusByUid.get(r.userId);
      return !s || s === "pending";
    }),
    [allRows, potStatusByUid]
  );

  const potCopyText = useMemo(() => {
    const lines = [`🏆 The Pot — Standings (${potRows.length} players)`, ""];
    if (potRows.length > 0) {
      lines.push(...potRows.map((r) => `${medal(r.rank)} ${r.displayName} — ${scoreLabel(r.totalScore)}`));
    } else {
      lines.push("No paid entries yet.");
    }
    return lines.join("\n");
  }, [potRows]);

  const overallCopyText = useMemo(() => {
    const lines = [`📊 Overall Standings (${overallRows.length} players)`, ""];
    lines.push(...overallRows.map((r) => `${medal(r.rank)} ${r.displayName} — ${scoreLabel(r.totalScore)}`));
    return lines.join("\n");
  }, [overallRows]);

  return (
    <div className="space-y-4">
      {lastUpdated ? (
        <p className="text-xs text-slate-600">Last updated: {lastUpdated}</p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* ── Overall ────────────────────────────────────────────────── */}
        <div>
          <AdminSectionLabel>Overall</AdminSectionLabel>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
              <div>
                <span className="text-sm font-semibold text-slate-100">All players</span>
                <span className="ml-2 text-xs text-slate-600">{overallRows.length}</span>
              </div>
              <CopyButton getText={() => overallCopyText} />
            </div>
            <LeaderboardTable rows={overallRows} emptyMessage="No leaderboard data yet." />
          </div>
        </div>

        {/* ── The Pot ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <AdminSectionLabel>The pot</AdminSectionLabel>

          {/* Paid players — main pot leaderboard */}
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-500/20">
              <div>
                <span className="text-sm font-semibold text-yellow-200">Paid — in the pot</span>
                <span className="ml-2 text-xs text-yellow-700">{potRows.length}</span>
              </div>
              <CopyButton getText={() => potCopyText} />
            </div>
            <LeaderboardTable
              rows={potRows}
              emptyMessage="No paid players yet — mark players as paid in Prize Pot."
            />
          </div>

          {/* Opted out */}
          {optedOutRows.length > 0 ? (
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/40">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  Opted out
                </span>
                <span className="text-xs text-slate-700">{optedOutRows.length}</span>
              </div>
              <ul className="divide-y divide-slate-800/40">
                {optedOutRows
                  .sort((a, b) => a.rank - b.rank)
                  .map((row) => (
                    <li key={row.userId} className="flex items-center gap-3 px-4 py-2">
                      <span className="flex-1 min-w-0 text-xs text-slate-500 truncate line-through">
                        {row.displayName}
                      </span>
                      <span className="text-xs text-slate-600 shrink-0 tabular-nums">
                        {scoreLabel(row.totalScore)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {/* No response */}
          {pendingRows.length > 0 ? (
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/40">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-600">
                  No response
                </span>
                <span className="text-xs text-slate-700">{pendingRows.length}</span>
              </div>
              <ul className="divide-y divide-slate-800/40">
                {pendingRows
                  .sort((a, b) => a.rank - b.rank)
                  .map((row) => (
                    <li key={row.userId} className="flex items-center gap-3 px-4 py-2">
                      <span className="flex-1 min-w-0 text-xs text-slate-400 truncate">
                        {row.displayName}
                      </span>
                      <span className="text-xs text-slate-600 shrink-0 tabular-nums">
                        {scoreLabel(row.totalScore)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminLeaderboardPage() {
  return (
    <AdminShell
      title="Standings"
      subtitle="Overall and pot-only leaderboards. Copy to share via WhatsApp."
      wide
    >
      <AdminGate>{() => <LeaderboardContent />}</AdminGate>
    </AdminShell>
  );
}
