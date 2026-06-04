"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell, AdminSectionLabel } from "@/components/admin/AdminShell";
import { LocalhostProductionWarning } from "@/components/admin/LocalhostProductionWarning";
import { functions } from "@/lib/firebase";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserData = {
  uid: string;
  displayName: string;
  email: string;
  hasTeams: boolean;
  teamCount: number;
  isMock: boolean;
  mockBatchId: string;
};

type SeedDepartmentMode = "round-robin" | "random" | "primary" | "secondary" | "admin";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return String(error);
}

function toUserData(value: unknown): UserData | null {
  if (!isRecord(value)) return null;
  const uid = typeof value.uid === "string" ? value.uid : "";
  if (!uid) return null;
  return {
    uid,
    displayName:
      typeof value.displayName === "string" && value.displayName.trim().length > 0
        ? value.displayName
        : "Unknown",
    email: typeof value.email === "string" ? value.email : "",
    hasTeams: value.hasTeams === true,
    teamCount:
      typeof value.teamCount === "number" && Number.isFinite(value.teamCount)
        ? Math.max(0, Math.floor(value.teamCount))
        : 0,
    isMock: value.isMock === true,
    mockBatchId: typeof value.mockBatchId === "string" ? value.mockBatchId : "",
  };
}

// ── Content ───────────────────────────────────────────────────────────────────

function AdminUsersContent({ uid }: { uid: string }) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  // Seeding
  const [seedCountInput, setSeedCountInput] = useState("24");
  const [seedDepartmentMode, setSeedDepartmentMode] = useState<SeedDepartmentMode>("round-robin");
  const [excludeMockUsersFromLeaderboard, setExcludeMockUsersFromLeaderboard] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState("");

  // Cleanup
  const [cleanupBatchId, setCleanupBatchId] = useState("");
  const [cleaningBatch, setCleaningBatch] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState("");

  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  const mockBatchIds = Array.from(
    new Set(users.filter((u) => u.isMock && u.mockBatchId).map((u) => u.mockBatchId))
  ).sort();

  const realUsers = users.filter((u) => !u.isMock);
  const mockUsers = users.filter((u) => u.isMock);

  async function loadUsers() {
    setLoading(true);
    setStatus("Loading…");
    try {
      const fn = httpsCallable<Record<string, never>, { ok?: boolean; users?: unknown }>(
        functions, "adminListUsers"
      );
      const res = await fn({});
      if (res.data.ok !== true || !Array.isArray(res.data.users)) {
        throw new Error("Invalid response");
      }
      const parsed = res.data.users.map(toUserData).filter((u): u is UserData => u !== null);
      setUsers(parsed);
      setStatus(`Loaded ${parsed.length} users.`);
    } catch (error) {
      setStatus(`❌ ${asErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function assignTeamsToUser(userId: string) {
    if (!confirm("Assign 1 featured + 5 drawn teams to this user?")) return;
    setProcessing(userId);
    try {
      const fn = httpsCallable<{ userId: string }, { ok?: boolean; message?: string; skipped?: boolean; featured?: string; drawn?: unknown }>(
        functions, "adminAssignTeamsToUser"
      );
      const res = await fn({ userId });
      if (res.data.skipped) {
        setStatus(`ℹ️ ${res.data.message ?? "User already has teams."}`);
      } else {
        const drawn = Array.isArray(res.data.drawn)
          ? res.data.drawn.filter((i): i is string => typeof i === "string")
          : [];
        setStatus(`✅ ${res.data.message ?? "Teams assigned."} Featured: ${res.data.featured ?? "—"}  Drawn: ${drawn.join(", ")}`);
      }
      await loadUsers();
    } catch (error) {
      setStatus(`❌ ${asErrorMessage(error)}`);
    } finally {
      setProcessing(null);
    }
  }

  async function assignTeamsToAllWithout() {
    const without = users.filter((u) => !u.hasTeams);
    if (without.length === 0) { setStatus("ℹ️ All users already have teams."); return; }
    if (!confirm(`Assign teams to ${without.length} users without teams?`)) return;
    setStatus(`Assigning teams to ${without.length} users…`);
    const fn = httpsCallable<{ userId: string }, unknown>(functions, "adminAssignTeamsToUser");
    let ok = 0, fail = 0;
    for (const u of without) {
      setProcessing(u.uid);
      try { await fn({ userId: u.uid }); ok++; } catch { fail++; }
    }
    setProcessing(null);
    setStatus(`✅ Assigned to ${ok} users. ${fail > 0 ? `${fail} failed.` : ""}`);
    await loadUsers();
  }

  async function seedMockUsers() {
    const count = Math.min(60, Math.max(1, Math.floor(Number(seedCountInput) || 24)));
    if (!confirm(`Create ${count} test players?\nGroup spread: ${seedDepartmentMode}\nHidden from leaderboard: ${excludeMockUsersFromLeaderboard ? "yes" : "no"}`)) {
      setSeedStatus("Cancelled."); return;
    }
    setSeeding(true);
    setSeedStatus("Creating…");
    try {
      const fn = httpsCallable<
        { count?: number; departmentMode?: string; recompute?: boolean; excludeMockUsersFromLeaderboard?: boolean },
        { ok?: boolean; batchTag?: string; created?: number; failed?: number; password?: string; excludeMockUsersFromLeaderboard?: boolean; recomputed?: boolean; errors?: unknown }
      >(functions, "adminSeedMockUsers");
      const res = await fn({ count, departmentMode: seedDepartmentMode, recompute: true, excludeMockUsersFromLeaderboard });
      const d = res.data;
      setSeedStatus(
        `✅ Batch ${d.batchTag ?? "—"}: created ${d.created ?? 0}${(d.failed ?? 0) > 0 ? `, failed ${d.failed}` : ""}. ` +
        `Password: ${d.password ?? "—"}. Hidden from LB: ${d.excludeMockUsersFromLeaderboard === false ? "no" : "yes"}.`
      );
      setCleanupBatchId(d.batchTag ?? "");
      await loadUsers();
    } catch (error) {
      setSeedStatus(`❌ ${asErrorMessage(error)}`);
    } finally {
      setSeeding(false);
    }
  }

  async function cleanupMockUsersByBatch() {
    const batchId = cleanupBatchId.trim();
    if (!batchId) { setCleanupStatus("❌ Enter a batch ID."); return; }
    if (!confirm(`Remove all test players in batch ${batchId}? This cannot be undone.`)) {
      setCleanupStatus("Cancelled."); return;
    }
    setCleaningBatch(true);
    setCleanupStatus(`Removing batch ${batchId}…`);
    try {
      const fn = httpsCallable<{ batchId: string }, { ok?: boolean; batchId?: string; deleted?: number }>(
        functions, "adminDeleteMockUsersByBatch"
      );
      const res = await fn({ batchId });
      setCleanupStatus(`✅ Removed ${res.data.deleted ?? 0} test players from batch ${res.data.batchId ?? batchId}.`);
      await loadUsers();
    } catch (error) {
      setCleanupStatus(`❌ ${asErrorMessage(error)}`);
    } finally {
      setCleaningBatch(false);
    }
  }

  const busy = loading || processing !== null || seeding || cleaningBatch;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Signed in as <span className="font-mono text-slate-400">{uid}</span>
      </p>

      <LocalhostProductionWarning onConfirmedChange={setDangerConfirmed} />

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">

        {/* ── Left: Player list ──────────────────────────────────────── */}
        <div className="space-y-3">
          <AdminSectionLabel>Players</AdminSectionLabel>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadUsers}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/90 text-emerald-950 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load Players"}
            </button>
            {users.length > 0 ? (
              <button
                onClick={assignTeamsToAllWithout}
                disabled={busy || !dangerConfirmed}
                className="px-3 py-1.5 rounded-xl bg-sky-500/90 text-sky-950 text-sm font-semibold disabled:opacity-50"
              >
                Assign Teams to All Without
              </button>
            ) : null}
          </div>

          {status ? (
            <p className="text-xs text-slate-300 whitespace-pre-wrap">{status}</p>
          ) : null}

          {users.length > 0 ? (
            <div className="space-y-3">
              {/* Real players */}
              {realUsers.length > 0 ? (
                <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Real players</span>
                    <span className="text-xs text-slate-600">{realUsers.length}</span>
                  </div>
                  <ul className="divide-y divide-slate-800/50">
                    {realUsers.map((user) => (
                      <li key={user.uid} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-100 truncate">{user.displayName}</div>
                          <div className="text-xs text-slate-500 truncate">{user.email}</div>
                        </div>
                        <div className="text-xs shrink-0">
                          {user.hasTeams
                            ? <span className="text-emerald-400">{user.teamCount} teams</span>
                            : <span className="text-rose-400">No teams</span>}
                        </div>
                        {!user.hasTeams ? (
                          <button
                            onClick={() => assignTeamsToUser(user.uid)}
                            disabled={processing === user.uid || !dangerConfirmed}
                            className="shrink-0 px-2.5 py-1 rounded-lg bg-sky-500/90 text-sky-950 text-xs font-semibold disabled:opacity-50"
                          >
                            {processing === user.uid ? "…" : "Assign"}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Mock players */}
              {mockUsers.length > 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-amber-500/20 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Test players</span>
                    <span className="text-xs text-amber-700">{mockUsers.length}</span>
                  </div>
                  <ul className="divide-y divide-amber-500/10 max-h-48 overflow-y-auto">
                    {mockUsers.map((user) => (
                      <li key={user.uid} className="flex items-center gap-3 px-4 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-300 truncate">{user.displayName}</div>
                          {user.mockBatchId ? (
                            <div className="text-[10px] text-slate-600 truncate">Batch: {user.mockBatchId}</div>
                          ) : null}
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">
                          {user.hasTeams ? `${user.teamCount}t` : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── Right: Tools ──────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Seed */}
          <div>
            <AdminSectionLabel>Create test players</AdminSectionLabel>
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Count</span>
                  <input
                    value={seedCountInput}
                    onChange={(e) => setSeedCountInput(e.target.value)}
                    inputMode="numeric"
                    className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Departments</span>
                  <select
                    value={seedDepartmentMode}
                    onChange={(e) => setSeedDepartmentMode(e.target.value as SeedDepartmentMode)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
                  >
                    <option value="round-robin">Round Robin</option>
                    <option value="random">Random</option>
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={excludeMockUsersFromLeaderboard}
                  onChange={(e) => setExcludeMockUsersFromLeaderboard(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Exclude from leaderboard
              </label>
              <button
                onClick={seedMockUsers}
                disabled={seeding || busy || !dangerConfirmed}
                className="w-full px-3 py-1.5 rounded-xl bg-amber-400/90 text-amber-950 text-sm font-semibold disabled:opacity-50"
              >
                {seeding ? "Creating…" : "Create Test Players"}
              </button>
              {seedStatus ? (
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{seedStatus}</p>
              ) : null}
            </div>
          </div>

          {/* Cleanup */}
          <div>
            <AdminSectionLabel>Remove test players</AdminSectionLabel>
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 space-y-3">
              <label className="space-y-1 block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Batch ID</span>
                <input
                  value={cleanupBatchId}
                  onChange={(e) => setCleanupBatchId(e.target.value)}
                  list="mock-batch-ids"
                  placeholder="paste or pick from list"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100"
                />
                <datalist id="mock-batch-ids">
                  {mockBatchIds.map((id) => <option key={id} value={id} />)}
                </datalist>
              </label>
              <button
                onClick={cleanupMockUsersByBatch}
                disabled={cleaningBatch || busy || !dangerConfirmed}
                className="w-full px-3 py-1.5 rounded-xl border border-rose-500/60 text-rose-100 text-sm font-semibold hover:bg-rose-500/10 disabled:opacity-50"
              >
                {cleaningBatch ? "Removing…" : "Remove Batch"}
              </button>
              {cleanupStatus ? (
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{cleanupStatus}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminShell title="Players" subtitle="View all players, assign teams, and manage test users." wide>
      <AdminGate>{({ uid }) => <AdminUsersContent uid={uid} />}</AdminGate>
    </AdminShell>
  );
}
