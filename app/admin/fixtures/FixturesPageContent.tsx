"use client";

import { useState } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell, AdminSectionLabel } from "@/components/admin/AdminShell";
import { FixtureIngestPanel } from "@/components/admin/FixtureIngestPanel";
import { LeaderboardRecomputePanel } from "@/components/admin/LeaderboardRecomputePanel";
import { LiveOpsConfigPanel } from "@/components/admin/LiveOpsConfigPanel";
import { LocalVisibleRehearsalPanel } from "@/components/admin/LocalVisibleRehearsalPanel";
import { LocalhostProductionWarning } from "@/components/admin/LocalhostProductionWarning";
import { ProviderShadowPanel } from "@/components/admin/ProviderShadowPanel";
import { TransferWindowPanel } from "@/components/admin/TransferWindowPanel";

function FixtureIngestContent({ uid }: { uid: string }) {
  const [maxMatches, setMaxMatches] = useState("");
  const [cutoffIso, setCutoffIso] = useState("");
  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  return (
    <div className="space-y-4">
      {/* Environment gate */}
      <LocalhostProductionWarning onConfirmedChange={setDangerConfirmed} />

      {/* ── Main 2-col grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 items-start">

        {/* ── Left column: Configuration ──────────────────────────── */}
        <div className="space-y-4">
          <div>
            <AdminSectionLabel>Live ops</AdminSectionLabel>
            <LiveOpsConfigPanel
              uid={uid}
              dangerConfirmed={dangerConfirmed}
              fixtureMaxMatches={maxMatches}
              fixtureCutoffIso={cutoffIso}
            />
          </div>

          <div>
            <AdminSectionLabel>Transfer window</AdminSectionLabel>
            <TransferWindowPanel uid={uid} dangerConfirmed={dangerConfirmed} />
          </div>
        </div>

        {/* ── Right column: Data & Scores ──────────────────────────── */}
        <div className="space-y-4">
          <div>
            <AdminSectionLabel>Match data</AdminSectionLabel>
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 space-y-0">
              <FixtureIngestPanel
                uid={uid}
                dangerConfirmed={dangerConfirmed}
                maxMatches={maxMatches}
                cutoffIso={cutoffIso}
                onMaxMatchesChange={setMaxMatches}
                onCutoffIsoChange={setCutoffIso}
              />
            </div>
          </div>

          <div>
            <AdminSectionLabel>Leaderboard &amp; scores</AdminSectionLabel>
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 space-y-0">
              <LeaderboardRecomputePanel uid={uid} dangerConfirmed={dangerConfirmed} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Testing row (full width, 2-col) ──────────────────────────── */}
      <div>
        <AdminSectionLabel>Testing &amp; simulation</AdminSectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <LocalVisibleRehearsalPanel uid={uid} dangerConfirmed={dangerConfirmed} />
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4">
            <ProviderShadowPanel uid={uid} dangerConfirmed={dangerConfirmed} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FixtureIngestPage() {
  return (
    <AdminShell title="Match Data" subtitle="Live score ingestion, fixture management, leaderboard and transfer controls." wide>
      <AdminGate>
        {({ uid }) => <FixtureIngestContent uid={uid} />}
      </AdminGate>
    </AdminShell>
  );
}
