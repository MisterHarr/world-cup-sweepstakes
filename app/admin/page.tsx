"use client";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";

const TOOLS = [
  {
    href: "/admin/fixtures",
    label: "Match Data",
    description: "Live ops mode, fixture ingest, transfer window, leaderboard recompute.",
    color: "border-sky-500/30 hover:border-sky-400/60 hover:bg-sky-500/5",
    badge: "sky",
  },
  {
    href: "/admin/users",
    label: "Players",
    description: "View all players, assign teams, seed and remove test users.",
    color: "border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/5",
    badge: "emerald",
  },
  {
    href: "/admin/leaderboard",
    label: "Standings",
    description: "Overall and pot-only leaderboards with copy-to-share for WhatsApp.",
    color: "border-sky-500/30 hover:border-sky-400/60 hover:bg-sky-500/5",
    badge: "sky",
  },
  {
    href: "/admin/pot",
    label: "Prize Pot",
    description: "Track offline cash payments and manage pot entry confirmation.",
    color: "border-yellow-500/30 hover:border-yellow-400/60 hover:bg-yellow-500/5",
    badge: "yellow",
  },
  {
    href: "/admin/seed-teams",
    label: "Teams",
    description: "Load all 48 teams into the database. Remove obsolete team docs.",
    color: "border-violet-500/30 hover:border-violet-400/60 hover:bg-violet-500/5",
    badge: "violet",
  },
  {
    href: "/admin/runbook",
    label: "Checklist",
    description: "Step-by-step guide: before, during, and after the tournament.",
    color: "border-slate-600/50 hover:border-slate-500/70 hover:bg-slate-800/40",
    badge: "slate",
  },
];

export default function AdminHomePage() {
  return (
    <AdminShell title="Admin Tools" subtitle="Internal controls — production changes take effect immediately.">
      <AdminGate>
        {({ uid }) => (
          <div className="space-y-6">
            <p className="text-xs text-slate-500">
              Signed in as <span className="font-mono text-slate-400">{uid}</span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TOOLS.map((tool) => (
                <a
                  key={tool.href}
                  href={tool.href}
                  className={`group rounded-xl border bg-slate-900/50 p-4 transition-colors ${tool.color}`}
                >
                  <div className="font-semibold text-slate-100 text-sm mb-1">
                    {tool.label}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {tool.description}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}
      </AdminGate>
    </AdminShell>
  );
}
