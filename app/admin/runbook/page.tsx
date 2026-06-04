"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";

const STEPS = [
  {
    n: "1",
    title: "Keep costs low",
    color: "border-slate-700/60",
    body: (
      <p className="text-sm text-slate-300">
        Keep <strong>Live Score Updates</strong> turned <strong>off</strong> when the tournament isn&apos;t actively running.
        Use <strong>Test data</strong> or <strong>Off</strong> as the data source during setup to avoid API usage.
      </p>
    ),
  },
  {
    n: "2",
    title: "Before the tournament",
    color: "border-sky-500/30",
    body: (
      <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
        <li>Open <strong>Match Data</strong> and confirm you&apos;re signed in as admin.</li>
        <li>Use <strong>Clear &amp; Reload</strong> to set a clean test baseline.</li>
        <li>Check that the Leaderboard and Live tab look correct.</li>
      </ol>
    ),
  },
  {
    n: "3",
    title: "Go live",
    color: "border-emerald-500/30",
    body: (
      <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
        <li>Set data source to <strong>Live scores (football-data.org)</strong>.</li>
        <li>Set mode to <strong>Production</strong> to enable scheduled updates.</li>
        <li>Click <strong>Save Settings</strong>.</li>
        <li>Confirm the success message and timestamp update.</li>
      </ol>
    ),
  },
  {
    n: "4",
    title: "If something goes wrong",
    color: "border-rose-500/30",
    body: (
      <p className="text-sm text-slate-300">
        If live updates stop working, turn off automation and run{" "}
        <strong>Load Match Data</strong> and <strong>Refresh Scores</strong> manually.
        Check the Leaderboard and Live tab after each action.
      </p>
    ),
  },
  {
    n: "5",
    title: "After the tournament",
    color: "border-violet-500/30",
    body: (
      <ol className="list-decimal pl-5 text-sm text-slate-300 space-y-1">
        <li>Set mode back to <strong>Disabled</strong>.</li>
        <li>Save settings and confirm the timestamp updates.</li>
        <li>Note the final leaderboard timestamp for your records.</li>
      </ol>
    ),
  },
  {
    n: "6",
    title: "Full technical runbook",
    color: "border-slate-700/60",
    body: (
      <p className="text-sm text-slate-300">
        Detailed procedures in <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">docs/TOURNAMENT-RUNBOOK.md</code>
      </p>
    ),
  },
];

export default function TournamentRunbookPage() {
  return (
    <AdminShell title="Tournament Checklist" subtitle="Steps to follow before, during, and after the tournament." wide>
      <AdminGate>
        {() => (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className={`rounded-xl border bg-slate-900/60 p-4 space-y-2 ${step.color}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300 shrink-0">
                    {step.n}
                  </span>
                  <h2 className="text-sm font-semibold text-slate-100">{step.title}</h2>
                </div>
                <div className="pl-8">{step.body}</div>
              </div>
            ))}
          </div>
        )}
      </AdminGate>
    </AdminShell>
  );
}
