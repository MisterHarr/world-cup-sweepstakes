"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";

import { AdminEnvironmentBadge } from "@/components/admin/AdminEnvironmentBadge";
import { AdminGate } from "@/components/admin/AdminGate";
import { LocalhostProductionWarning } from "@/components/admin/LocalhostProductionWarning";
import { functions } from "@/lib/firebase";

type UserData = {
  uid: string;
  displayName: string;
  email: string;
  hasTeams: boolean;
  teamCount: number;
  isMock: boolean;
  mockBatchId: string;
};

type AdminListUsersResponse = {
  ok?: boolean;
  users?: unknown;
};

type AdminAssignTeamsResponse = {
  ok?: boolean;
  message?: string;
  skipped?: boolean;
  featured?: string;
  drawn?: unknown;
};

type AssignTeamsPayload = {
  userId: string;
};

type SeedDepartmentMode =
  | "round-robin"
  | "random"
  | "primary"
  | "secondary"
  | "admin";

type AdminSeedMockUsersPayload = {
  count?: number;
  departmentMode?: SeedDepartmentMode;
  recompute?: boolean;
  prefix?: string;
  batchTag?: string;
  excludeMockUsersFromLeaderboard?: boolean;
};

type AdminSeedMockUsersResponse = {
  ok?: boolean;
  batchTag?: string;
  countRequested?: number;
  created?: number;
  failed?: number;
  password?: string;
  departmentMode?: string;
  excludeMockUsersFromLeaderboard?: boolean;
  recomputed?: boolean;
  sampleUsers?: unknown;
  errors?: unknown;
};

type DeleteMockUsersPayload = {
  batchId: string;
  dryRun?: boolean;
};

type DeleteMockUsersResponse = {
  ok?: boolean;
  batchId?: string;
  dryRun?: boolean;
  mockUsers?: number;
  deleted?: number;
};

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
    mockBatchId:
      typeof value.mockBatchId === "string" ? value.mockBatchId : "",
  };
}

function AdminUsersContent(props: { uid: string }) {
  const { uid } = props;
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [seedCountInput, setSeedCountInput] = useState("24");
  const [seedDepartmentMode, setSeedDepartmentMode] =
    useState<SeedDepartmentMode>("round-robin");
  const [excludeMockUsersFromLeaderboard, setExcludeMockUsersFromLeaderboard] =
    useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState("");
  const [cleanupBatchId, setCleanupBatchId] = useState("");
  const [cleaningBatch, setCleaningBatch] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState("");
  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  const mockBatchIds = Array.from(
    new Set(users.filter((user) => user.isMock && user.mockBatchId).map((user) => user.mockBatchId))
  ).sort();

  async function loadUsers() {
    setLoading(true);
    setStatus("Loading users...");

    try {
      const fn = httpsCallable<Record<string, never>, AdminListUsersResponse>(
        functions,
        "adminListUsers"
      );
      const res = await fn({});
      const data = res.data;

      if (data.ok !== true || !Array.isArray(data.users)) {
        throw new Error("Invalid response from server");
      }

      const parsedUsers = data.users
        .map((entry) => toUserData(entry))
        .filter((entry): entry is UserData => entry !== null);

      setUsers(parsedUsers);
      setStatus(`✅ Loaded ${parsedUsers.length} users.`);
    } catch (error: unknown) {
      console.error(error);
      setStatus(`❌ ${asErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function assignTeamsToUser(userId: string) {
    if (
      !confirm(
        "Assign teams to this user? This will give them 1 featured + 5 drawn teams."
      )
    ) {
      return;
    }

    setProcessing(userId);
    setStatus(`Assigning teams to user ${userId}...`);

    try {
      const fn = httpsCallable<AssignTeamsPayload, AdminAssignTeamsResponse>(
        functions,
        "adminAssignTeamsToUser"
      );
      const res = await fn({ userId });
      const data = res.data;

      if (data.skipped) {
        setStatus(`ℹ️ ${data.message ?? "User already has teams assigned."}`);
      } else {
        const drawnTeams = Array.isArray(data.drawn)
          ? data.drawn.filter((item): item is string => typeof item === "string")
          : [];

        setStatus(
          `✅ ${data.message ?? "Teams assigned."}\nFeatured: ${data.featured ?? "-"}\nDrawn: ${drawnTeams.join(", ")}`
        );
      }

      await loadUsers();
    } catch (error: unknown) {
      console.error(error);
      setStatus(`❌ ${asErrorMessage(error)}`);
    } finally {
      setProcessing(null);
    }
  }

  async function assignTeamsToAllWithout() {
    const usersWithoutTeams = users.filter((user) => !user.hasTeams);

    if (usersWithoutTeams.length === 0) {
      setStatus("ℹ️ All users already have teams.");
      return;
    }

    if (
      !confirm(
        `Assign teams to ${usersWithoutTeams.length} users without teams? This cannot be undone.`
      )
    ) {
      return;
    }

    setStatus(`Assigning teams to ${usersWithoutTeams.length} users...`);
    let successCount = 0;
    let errorCount = 0;
    const fn = httpsCallable<AssignTeamsPayload, AdminAssignTeamsResponse>(
      functions,
      "adminAssignTeamsToUser"
    );

    for (const user of usersWithoutTeams) {
      setProcessing(user.uid);

      try {
        await fn({ userId: user.uid });
        successCount++;
      } catch (error: unknown) {
        console.error(`Failed for ${user.email}:`, error);
        errorCount++;
      }
    }

    setProcessing(null);
    setStatus(`✅ Assigned teams to ${successCount} users. ${errorCount} errors.`);
    await loadUsers();
  }

  async function seedMockUsers() {
    const parsed = Number(seedCountInput);
    const count =
      Number.isFinite(parsed) && parsed > 0
        ? Math.min(60, Math.floor(parsed))
        : 24;

    if (
      !confirm(
        `Create ${count} mock users with seeded squads?\n` +
          `Department mode: ${seedDepartmentMode}\n` +
          `Excluded from leaderboard: ${excludeMockUsersFromLeaderboard ? "yes" : "no"}\n` +
          `Password will be generated for this batch.`
      )
    ) {
      setSeedStatus("Cancelled.");
      return;
    }

    setSeeding(true);
    setSeedStatus("Seeding mock users...");

    try {
      const fn = httpsCallable<
        AdminSeedMockUsersPayload,
        AdminSeedMockUsersResponse
      >(functions, "adminSeedMockUsers");
      const res = await fn({
        count,
        departmentMode: seedDepartmentMode,
        recompute: true,
        excludeMockUsersFromLeaderboard,
      });
      const data = res.data;

      const failures = Number(data.failed ?? 0);
      const created = Number(data.created ?? 0);
      const tag = String(data.batchTag ?? "-");
      const recomputed = data.recomputed === true ? "yes" : "no";
      const password = String(data.password ?? "-");
      const excluded =
        data.excludeMockUsersFromLeaderboard === false ? "no" : "yes";

      let errorPreview = "";
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0];
        if (isRecord(first)) {
          errorPreview = ` First failure: ${String(first.reason ?? "unknown")}`;
        }
      }

      setSeedStatus(
        `✅ Batch ${tag}: created ${created}, failed ${failures}. ` +
          `Leaderboard recomputed: ${recomputed}. Excluded from leaderboard: ${excluded}. ` +
          `Login password: ${password}.` +
          errorPreview
      );
      setCleanupBatchId(tag);

      await loadUsers();
    } catch (error: unknown) {
      console.error(error);
      setSeedStatus(`❌ ${asErrorMessage(error)}`);
    } finally {
      setSeeding(false);
    }
  }

  async function cleanupMockUsersByBatch() {
    const batchId = cleanupBatchId.trim();
    if (!batchId) {
      setCleanupStatus("❌ Enter a mock batch id first.");
      return;
    }

    if (
      !confirm(
        `Delete all mock users in batch ${batchId}?\nThis removes their auth accounts and user docs, then recomputes the leaderboard.`
      )
    ) {
      setCleanupStatus("Cancelled.");
      return;
    }

    setCleaningBatch(true);
    setCleanupStatus(`Deleting mock users from batch ${batchId}...`);

    try {
      const fn = httpsCallable<DeleteMockUsersPayload, DeleteMockUsersResponse>(
        functions,
        "adminDeleteMockUsersByBatch"
      );
      const res = await fn({ batchId });
      const data = res.data;
      setCleanupStatus(
        `✅ Deleted ${Number(data.deleted ?? 0)} mock users from batch ${String(
          data.batchId ?? batchId
        )}.`
      );
      await loadUsers();
    } catch (error: unknown) {
      console.error(error);
      setCleanupStatus(`❌ ${asErrorMessage(error)}`);
    } finally {
      setCleaningBatch(false);
    }
  }

  return (
    <>
      <div className="text-sm text-slate-300">
        Signed in as <strong>{uid}</strong>
      </div>

      <LocalhostProductionWarning onConfirmedChange={setDangerConfirmed} />

      <div className="flex flex-wrap gap-3">
        <button
          onClick={loadUsers}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load Users"}
        </button>

        {users.length > 0 ? (
          <button
            onClick={assignTeamsToAllWithout}
            disabled={loading || processing !== null || !dangerConfirmed}
            className="px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
          >
            Assign Teams to All Without
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4 space-y-3">
        <div className="text-sm font-semibold text-slate-100">
          Mock User Batch Seeding
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider">
              Count
            </div>
            <input
              value={seedCountInput}
              onChange={(event) => setSeedCountInput(event.target.value)}
              inputMode="numeric"
              className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider">
              Departments
            </div>
            <select
              value={seedDepartmentMode}
              onChange={(event) =>
                setSeedDepartmentMode(event.target.value as SeedDepartmentMode)
              }
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="round-robin">Round Robin</option>
              <option value="random">Random</option>
              <option value="primary">Primary Only</option>
              <option value="secondary">Secondary Only</option>
              <option value="admin">Admin Only</option>
            </select>
          </label>

          <button
            onClick={seedMockUsers}
            disabled={seeding || loading || processing !== null || !dangerConfirmed}
            className="px-4 py-2 rounded-xl bg-amber-400/90 text-amber-950 font-semibold disabled:opacity-50"
          >
            {seeding ? "Seeding..." : "Seed Mock Users"}
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Creates auth + Firestore users with teams assigned, marks reveal as seen,
          and recomputes leaderboard.
        </p>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={excludeMockUsersFromLeaderboard}
            onChange={(event) =>
              setExcludeMockUsersFromLeaderboard(event.target.checked)
            }
            className="h-4 w-4"
          />
          Exclude mock users from leaderboard
        </label>

        {seedStatus ? (
          <div className="text-sm text-slate-300 whitespace-pre-wrap">
            {seedStatus}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 p-4 space-y-3">
        <div className="text-sm font-semibold text-slate-100">
          Mock User Cleanup
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <div className="text-xs text-slate-400 uppercase tracking-wider">
              Batch Id
            </div>
            <input
              value={cleanupBatchId}
              onChange={(event) => setCleanupBatchId(event.target.value)}
              list="mock-batch-ids"
              className="min-w-[240px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
            <datalist id="mock-batch-ids">
              {mockBatchIds.map((batchId) => (
                <option key={batchId} value={batchId} />
              ))}
            </datalist>
          </label>

          <button
            onClick={cleanupMockUsersByBatch}
            disabled={cleaningBatch || seeding || loading || processing !== null || !dangerConfirmed}
            className="px-4 py-2 rounded-xl border border-rose-500/60 text-rose-100 font-semibold hover:bg-rose-500/10 disabled:opacity-50"
          >
            {cleaningBatch ? "Cleaning..." : "Delete Mock Users by Batch"}
          </button>
        </div>

        {cleanupStatus ? (
          <div className="text-sm text-slate-300 whitespace-pre-wrap">
            {cleanupStatus}
          </div>
        ) : null}
      </div>

      {status ? (
        <div className="text-sm text-slate-300 whitespace-pre-wrap">{status}</div>
      ) : null}

      {users.length > 0 ? (
        <div className="border-t border-slate-800/60 pt-4">
          <h2 className="text-lg font-semibold mb-4">Users ({users.length})</h2>

          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.uid}
                className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-100">
                    {user.displayName}
                    {user.isMock ? (
                      <span className="ml-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
                        Mock
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-slate-400">{user.email}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {user.hasTeams
                      ? `✅ Has ${user.teamCount} teams`
                      : "❌ No teams assigned"}
                  </div>
                  {user.isMock && user.mockBatchId ? (
                    <div className="text-xs text-slate-500 mt-1">
                      Batch: {user.mockBatchId}
                    </div>
                  ) : null}
                </div>

                {!user.hasTeams ? (
                  <button
                    onClick={() => assignTeamsToUser(user.uid)}
                    disabled={processing === user.uid || !dangerConfirmed}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/90 text-sky-950 text-sm font-semibold disabled:opacity-50"
                  >
                    {processing === user.uid ? "Assigning..." : "Assign Teams"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin · User Management
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

          <AdminGate>{({ uid }) => <AdminUsersContent uid={uid} />}</AdminGate>
        </div>
      </div>
    </div>
  );
}
