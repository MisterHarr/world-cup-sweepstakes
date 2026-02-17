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

export default function AdminUsersPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

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
      const fn = httpsCallable(functions, "adminListUsers");
      const res = await fn({});
      const data = res.data as any;

      if (!data.ok || !Array.isArray(data.users)) {
        throw new Error("Invalid response from server");
      }

      setUsers(data.users);
      setStatus(`✅ Loaded ${data.users.length} users.`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err.message ?? String(err)}`);
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
      const fn = httpsCallable(functions, "adminAssignTeamsToUser");
      const res = await fn({ userId });
      const data = res.data as any;

      if (data.skipped) {
        setStatus(`ℹ️ ${data.message}`);
      } else {
        setStatus(
          `✅ ${data.message}\nFeatured: ${data.featured}\nDrawn: ${data.drawn.join(", ")}`
        );
      }

      // Reload users to reflect changes
      await loadUsers();
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err?.message ?? String(err)}`);
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

    for (const user of usersWithoutTeams) {
      setProcessing(user.uid);
      try {
        const fn = httpsCallable(functions, "adminAssignTeamsToUser");
        await fn({ userId: user.uid });
        successCount++;
      } catch (err: any) {
        console.error(`Failed for ${user.email}:`, err);
        errorCount++;
      }
    }

    setProcessing(null);
    setStatus(`✅ Assigned teams to ${successCount} users. ${errorCount} errors.`);
    await loadUsers();
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
              <div className="flex gap-3">
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
