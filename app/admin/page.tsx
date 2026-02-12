"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdTokenResult } from "firebase/auth";

export default function AdminHomePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">
              Admin · Tools
            </h1>
            <span className="text-xs uppercase tracking-widest text-slate-400">
              Internal
            </span>
          </div>

          <div className="mt-4 text-sm text-slate-300">
            Signed in: <strong>{uid ? "Yes" : "No"}</strong>{" · "}
            Admin: <strong>{isAdmin ? "Yes" : "No"}</strong>
          </div>

          <div className="mt-6">
            {checking ? (
              <div className="text-sm text-slate-400">Checking access…</div>
            ) : !uid ? (
              <div className="text-sm text-slate-400">
                Please sign in to access admin tools.
              </div>
            ) : !isAdmin ? (
              <div className="text-sm text-slate-400">Not authorized.</div>
            ) : (
              <div className="grid gap-3 text-sm">
                <a
                  href="/admin/seed-teams"
                  className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:text-emerald-200"
                >
                  Seed Teams
                </a>
                <a
                  href="/admin/fixtures"
                  className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:text-emerald-200"
                >
                  Fixture Ingest
                </a>
                <a
                  href="/admin/runbook"
                  className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:text-emerald-200"
                >
                  Tournament Runbook
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
