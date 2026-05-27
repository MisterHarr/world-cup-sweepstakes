"use client";

import { AdminEnvironmentBadge } from "@/components/admin/AdminEnvironmentBadge";
import { AdminGate } from "@/components/admin/AdminGate";

export default function AdminHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin · Tools
              </h1>
              <span className="text-xs uppercase tracking-widest text-slate-400">
                Internal
              </span>
            </div>
            <AdminEnvironmentBadge />
          </div>

          <div className="mt-6">
            <AdminGate>
              {({ uid }) => (
                <>
                  <div className="mb-4 text-sm text-slate-300">
                    Signed in as <strong>{uid}</strong>
                  </div>
                  <div className="grid gap-3 text-sm">
                    <a
                      href="/admin/seed-teams"
                      className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:text-emerald-200"
                    >
                      Seed Teams
                    </a>
                    <a
                      href="/admin/users"
                      className="rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 text-slate-100 shadow-sm transition hover:border-emerald-400/60 hover:text-emerald-200"
                    >
                      User Management
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
                    <a
                      href="/admin/pot"
                      className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 text-yellow-200 shadow-sm transition hover:border-yellow-400/60 hover:text-yellow-100"
                    >
                      🏆 Prize Pot — Confirmation Panel
                    </a>
                  </div>
                </>
              )}
            </AdminGate>
          </div>
        </div>
      </div>
    </div>
  );
}
