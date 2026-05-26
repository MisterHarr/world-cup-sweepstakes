"use client";

import { useState } from "react";
import { AdminEnvironmentBadge } from "@/components/admin/AdminEnvironmentBadge";
import { AdminGate } from "@/components/admin/AdminGate";
import { FixtureIngestPanel } from "@/components/admin/FixtureIngestPanel";
import { LeaderboardRecomputePanel } from "@/components/admin/LeaderboardRecomputePanel";
import { LiveOpsConfigPanel } from "@/components/admin/LiveOpsConfigPanel";
import { LocalVisibleRehearsalPanel } from "@/components/admin/LocalVisibleRehearsalPanel";
import { LocalhostProductionWarning } from "@/components/admin/LocalhostProductionWarning";
import { ProviderShadowPanel } from "@/components/admin/ProviderShadowPanel";
import { TransferWindowPanel } from "@/components/admin/TransferWindowPanel";

function FixtureIngestContent(props: { uid: string }) {
  const { uid } = props;
  const [maxMatches, setMaxMatches] = useState("");
  const [cutoffIso, setCutoffIso] = useState("");
  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  return (
    <>
      <div className="text-sm text-slate-300">
        Signed in as <strong>{uid}</strong>
      </div>

      <LocalhostProductionWarning onConfirmedChange={setDangerConfirmed} />

      <LiveOpsConfigPanel
        uid={uid}
        dangerConfirmed={dangerConfirmed}
        fixtureMaxMatches={maxMatches}
        fixtureCutoffIso={cutoffIso}
      />

      <TransferWindowPanel uid={uid} dangerConfirmed={dangerConfirmed} />

      <LocalVisibleRehearsalPanel uid={uid} dangerConfirmed={dangerConfirmed} />

      <FixtureIngestPanel
        uid={uid}
        dangerConfirmed={dangerConfirmed}
        maxMatches={maxMatches}
        cutoffIso={cutoffIso}
        onMaxMatchesChange={setMaxMatches}
        onCutoffIsoChange={setCutoffIso}
      />

      <ProviderShadowPanel uid={uid} dangerConfirmed={dangerConfirmed} />

      <LeaderboardRecomputePanel uid={uid} dangerConfirmed={dangerConfirmed} />
    </>
  );
}

export default function FixtureIngestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin · Fixture Ingest
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

          <AdminGate>{({ uid }) => <FixtureIngestContent uid={uid} />}</AdminGate>
        </div>
      </div>
    </div>
  );
}
