"use client";

import { AdminEnvironmentBadge } from "@/components/admin/AdminEnvironmentBadge";
import { AdminGate } from "@/components/admin/AdminGate";

export default function TournamentRunbookPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Tournament Checklist
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
          <p className="mt-4 text-sm text-slate-300">
            Steps to follow before, during and after the tournament.
          </p>
        </div>
        <AdminGate>
          {() => (
            <>
              <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
                <h2 className="text-lg font-semibold">1) Keep Costs Low</h2>
                <p className="text-sm text-slate-300">
                  Keep <strong>Live Score Updates</strong> turned{" "}
                  <strong>off</strong> when the tournament isn't actively running.
                  Use <strong>Test data</strong> or <strong>Off</strong> as the data source during setup.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
                <h2 className="text-lg font-semibold">2) Before the Tournament</h2>
                <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
                  <li>Open <strong>Match Data</strong> and confirm you're signed in as admin.</li>
                  <li>Use <strong>Clear &amp; Reload</strong> to set a clean test baseline.</li>
                  <li>Check that the Leaderboard and Match Centre look correct.</li>
                </ol>
              </section>

              <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
                <h2 className="text-lg font-semibold">3) Go Live</h2>
                <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
                  <li>Set data source to <strong>Live scores (football-data.org)</strong>.</li>
                  <li>Set mode to <strong>Production</strong> to enable scheduled updates.</li>
                  <li>Click <strong>Save Settings</strong>.</li>
                  <li>Confirm the success message and timestamp update.</li>
                </ol>
              </section>

              <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
                <h2 className="text-lg font-semibold">4) If Something Goes Wrong</h2>
                <p className="text-sm text-slate-300">
                  If live updates stop working, turn off automation and run
                  <strong> Load Match Data</strong> and <strong>Refresh Scores</strong> manually.
                  Check the Leaderboard and Live tab after each action.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
                <h2 className="text-lg font-semibold">5) After the Tournament</h2>
                <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
                  <li>Set mode back to <strong>Disabled</strong>.</li>
                  <li>Save settings and confirm the timestamp updates.</li>
                  <li>Note the final leaderboard timestamp for your records.</li>
                </ol>
              </section>

              <section className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 space-y-3">
                <h2 className="text-lg font-semibold">Full details</h2>
                <p className="text-sm text-slate-300">
                  Technical runbook: <code>docs/TOURNAMENT-RUNBOOK.md</code>
                </p>
              </section>
            </>
          )}
        </AdminGate>
      </div>
    </div>
  );
}
