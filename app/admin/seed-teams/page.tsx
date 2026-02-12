"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { getIdTokenResult } from "firebase/auth";
import { TEAMS_SEED } from "@/lib/seed/teamsSeed";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function SeedTeamsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState(true);

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

  const teamCount = useMemo(() => TEAMS_SEED.length, []);

  async function seedTeams() {
    setStatus("Seeding teams...");
    try {
      if (!uid) throw new Error("Not signed in.");
      if (!isAdmin) throw new Error("Admin access required.");

      for (const team of TEAMS_SEED) {
        await setDoc(
          doc(db, "teams", team.id),
          {
            ...team,
            teamId: team.id, // redundancy helps queries
            updatedAt: serverTimestamp(),
          } as any,
          { merge: true }
        );
      }

      setStatus(`✅ Successfully seeded ${teamCount} teams.`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ ${err.message ?? String(err)}`);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin · Seed Teams
            </h1>
            <a
              href="/admin"
              className="text-xs uppercase tracking-widest text-slate-400 hover:text-emerald-200"
            >
              Back to Tools
            </a>
          </div>

          <div className="text-sm text-slate-300">
            Signed in: <strong>{uid ? "Yes" : "No"}</strong>{" · "}
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
              <div className="text-sm">
                <a
                  href="/admin/fixtures"
                  className="text-emerald-200 underline"
                >
                  Go to Fixture Ingest
                </a>
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
                This will write <strong>{teamCount}</strong> teams to the
                <code className="ml-1">teams</code> collection.
              </div>

              <button
                onClick={seedTeams}
                disabled={!uid || !isAdmin}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
              >
                Seed Teams
              </button>

              <div className="text-sm text-slate-300">{status}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
