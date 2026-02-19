"use client";

import { useEffect, useState } from "react";
import { auth, functions } from "@/lib/firebase";
import { getIdTokenResult } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

type UserData = {
  uid: string;
  displayName: string;
  email: string;
  hasTeams: boolean;
  teamCount: number;
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
  password?: string;
  departmentMode?: SeedDepartmentMode;
  recompute?: boolean;
  prefix?: string;
  batchTag?: string;
};

type AdminSeedMockUsersResponse = {
  ok?: boolean;
  batchTag?: string;
  countRequested?: number;
  created?: number;
  failed?: number;
  password?: string;
  departmentMode?: string;
  recomputed?: boolean;
  sampleUsers?: unknown;
  errors?: unknown;
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
  };
}

export default function AdminUsersPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [seedCountInput, setSeedCountInput] = useState("24");
  const [seedDepartmentMode, setSeedDepartmentMode] =
    useState<SeedDepartmentMode>("round-robin");
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState("");

  // Check auth + admin status
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setUid(user?.uid ?? null);
      setIsAdmin(false);
      setChecking(true);

      if (!user) {
        setChecking(false);
        return;
      }

      try {
        const token = await getIdTokenResult(user, true);
        setIsAdmin(token.claims.admin === true);
      } catch (err) {
        console.error(err);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, []);

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
    } catch (err: unknown) {
      console.error(err);
      setStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function assignTeamsToUser(userId: string) {
    if (!confirm("Assign teams to this user? This will give them 1 featured + 5 drawn teams.")) {
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

      // Reload users to reflect changes
      await loadUsers();
    } catch (err: unknown) {
      console.error(err);
      setStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setProcessing(null);
    }
  }

  async function assignTeamsToAllWithout() {
    const usersWithoutTeams = users.filter((u) => !u.hasTeams);

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
      } catch (err: unknown) {
        console.error(`Failed for ${user.email}:`, err);
        errorCount++;
      }
    }

    setProcessing(null);
    setStatus(`✅ Assigned teams to ${successCount} users. ${errorCount} errors.`);
    await loadUsers();
  }

  async function seedMockUsers() {
    if (!uid) {
      setSeedStatus("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setSeedStatus("❌ Admin access required.");
      return;
    }

    const parsed = Number(seedCountInput);
    const count =
      Number.isFinite(parsed) && parsed > 0
        ? Math.min(60, Math.floor(parsed))
        : 24;

    if (
      !confirm(
        `Create ${count} mock users with seeded squads?\n` +
          `Department mode: ${seedDepartmentMode}\n` +
          `Default password: Test1234!`
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
      });
      const data = res.data;

      const failures = Number(data.failed ?? 0);
      const created = Number(data.created ?? 0);
      const tag = String(data.batchTag ?? "-");
      const recomputed = data.recomputed === true ? "yes" : "no";

      let errorPreview = "";
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0];
        if (isRecord(first)) {
          errorPreview = ` First failure: ${String(first.reason ?? "unknown")}`;
        }
      }

      setSeedStatus(
        `✅ Batch ${tag}: created ${created}, failed ${failures}. ` +
          `Leaderboard recomputed: ${recomputed}. Login password: Test1234!.` +
          errorPreview
      );

      await loadUsers();
    } catch (err: unknown) {
      console.error(err);
      setSeedStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
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

          <div className="text-sm text-slate-300">
            Signed in: <strong>{uid ? "Yes" : "No"}</strong>
            {" · "}
            Admin: <strong>{isAdmin ? "Yes" : "No"}</strong>
          </div>

          {checking ? (
            <div className="text-sm text-slate-400">Checking access…</div>
          ) : !uid ? (
            <div className="text-sm text-slate-400">
              Please sign in to access admin tools.
            </div>
          ) : !isAdmin ? (
            <div className="text-sm text-slate-400">Not authorized.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={loadUsers}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Load Users"}
                </button>

                {users.length > 0 && (
                  <button
                    onClick={assignTeamsToAllWithout}
                    disabled={loading || processing !== null}
                    className="px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
                  >
                    Assign Teams to All Without
                  </button>
                )}
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
                    disabled={seeding || loading || processing !== null}
                    className="px-4 py-2 rounded-xl bg-amber-400/90 text-amber-950 font-semibold disabled:opacity-50"
                  >
                    {seeding ? "Seeding..." : "Seed Mock Users"}
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  Creates auth + Firestore users with teams assigned, marks reveal as seen, and recomputes leaderboard.
                </p>

                {seedStatus ? (
                  <div className="text-sm text-slate-300 whitespace-pre-wrap">
                    {seedStatus}
                  </div>
                ) : null}
              </div>

              {status && (
                <div className="text-sm text-slate-300 whitespace-pre-wrap">{status}</div>
              )}

              {users.length > 0 && (
                <div className="border-t border-slate-800/60 pt-4">
                  <h2 className="text-lg font-semibold mb-4">
                    Users ({users.length})
                  </h2>

                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.uid}
                        className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-100">
                            {user.displayName}
                          </div>
                          <div className="text-sm text-slate-400">{user.email}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {user.hasTeams
                              ? `✅ Has ${user.teamCount} teams`
                              : "❌ No teams assigned"}
                          </div>
                        </div>

                        {!user.hasTeams && (
                          <button
                            onClick={() => assignTeamsToUser(user.uid)}
                            disabled={processing === user.uid}
                            className="px-3 py-1.5 rounded-lg bg-sky-500/90 text-sky-950 text-sm font-semibold disabled:opacity-50"
                          >
                            {processing === user.uid
                              ? "Assigning..."
                              : "Assign Teams"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
