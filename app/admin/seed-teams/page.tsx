"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, setDoc, serverTimestamp, type WithFieldValue } from "firebase/firestore";

import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell, AdminSectionLabel } from "@/components/admin/AdminShell";
import { LocalhostProductionWarning } from "@/components/admin/LocalhostProductionWarning";
import { db, functions } from "@/lib/firebase";
import { TEAMS_SEED } from "@/lib/seed/teamsSeed";
import type { Team } from "@/types";

type TeamSeedDocument = Team & { teamId: string; updatedAt: unknown };
type OrphanPreviewResponse = {
  ok?: boolean;
  orphanIds?: string[];
  orphanCount?: number;
  deleted?: number;
  affectedUserCount?: number;
  affectedUsers?: Array<{ uid: string; displayName: string; email: string; teamIds: string[] }>;
};
type OrphanDeletePayload = { allowedTeamIds: string[]; confirmationText: string };

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return String(error);
}

function SeedTeamsContent({ uid }: { uid: string }) {
  const [status, setStatus] = useState("");
  const [orphanStatus, setOrphanStatus] = useState("");
  const [orphanPreview, setOrphanPreview] = useState<OrphanPreviewResponse | null>(null);
  const [orphanConfirmation, setOrphanConfirmation] = useState("");
  const [dangerConfirmed, setDangerConfirmed] = useState(false);
  const teamCount = useMemo(() => TEAMS_SEED.length, []);

  async function seedTeams() {
    setStatus("Seeding teams…");
    try {
      for (const team of TEAMS_SEED) {
        const payload: WithFieldValue<TeamSeedDocument> = { ...team, teamId: team.id, updatedAt: serverTimestamp() };
        await setDoc(doc(db, "teams", team.id), payload, { merge: true });
      }
      setStatus(`✅ All ${teamCount} teams loaded. Old team IDs are not removed automatically — use "Remove old teams" if needed.`);
    } catch (error) {
      setStatus(`❌ ${asErrorMessage(error)}`);
    }
  }

  async function deleteOrphanTeamDocs() {
    setOrphanStatus("Scanning…");
    try {
      const fn = httpsCallable<{ allowedTeamIds: string[] }, OrphanPreviewResponse>(functions, "adminPreviewOrphanTeamDeletion");
      const res = await fn({ allowedTeamIds: TEAMS_SEED.map((t) => t.id) });
      const data = res.data;
      setOrphanPreview(data);
      const orphanIds = Array.isArray(data.orphanIds) ? data.orphanIds : [];
      if (orphanIds.length === 0) {
        setOrphanStatus("✅ No old teams to remove.");
        return;
      }
      setOrphanStatus(`⚠️ Found ${orphanIds.length} old team(s) affecting ${data.affectedUserCount ?? 0} player(s). Review below, then type DELETE ORPHAN TEAMS to proceed.`);
    } catch (error) {
      setOrphanStatus(`❌ ${asErrorMessage(error)}`);
    }
  }

  async function confirmDeleteOrphanTeamDocs() {
    setOrphanStatus("Removing…");
    try {
      const fn = httpsCallable<OrphanDeletePayload, OrphanPreviewResponse>(functions, "adminDeleteOrphanTeamDocs");
      const res = await fn({ allowedTeamIds: TEAMS_SEED.map((t) => t.id), confirmationText: orphanConfirmation });
      const data = res.data;
      const orphanIds = Array.isArray(data.orphanIds) ? data.orphanIds : [];
      setOrphanStatus(`✅ Deleted ${data.deleted ?? orphanIds.length} orphan doc(s): ${orphanIds.join(", ")}. Affected users: ${data.affectedUserCount ?? 0}.`);
      setOrphanPreview(null);
      setOrphanConfirmation("");
    } catch (error) {
      setOrphanStatus(`❌ ${asErrorMessage(error)}`);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Signed in as <span className="font-mono text-slate-400">{uid}</span>
      </p>

      <LocalhostProductionWarning onConfirmedChange={setDangerConfirmed} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

        {/* ── Left: Set up teams ──────────────────────────────────── */}
        <div>
          <AdminSectionLabel>Load teams</AdminSectionLabel>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 space-y-3">
            <p className="text-sm text-slate-300">
              Writes all <strong>{teamCount}</strong> teams into the database. Safe to run more than once — uses merge so no data is lost.
            </p>
            <button
              type="button"
              onClick={seedTeams}
              disabled={!dangerConfirmed}
              className="w-full px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 text-sm font-semibold disabled:opacity-50"
            >
              Set Up Teams
            </button>
            {status ? <p className="text-xs text-slate-300 whitespace-pre-wrap">{status}</p> : null}
          </div>
        </div>

        {/* ── Right: Remove old teams ─────────────────────────────── */}
        <div>
          <AdminSectionLabel>Remove old teams</AdminSectionLabel>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <p className="text-sm text-slate-300">
              Scans for team docs that are no longer in the current list (e.g. after a squad change). Shows affected players before deleting.
            </p>
            <button
              type="button"
              onClick={() => void deleteOrphanTeamDocs()}
              disabled={!dangerConfirmed}
              className="w-full px-4 py-2 rounded-xl border border-amber-500/60 text-amber-100 text-sm font-semibold hover:bg-amber-500/10 disabled:opacity-50"
            >
              Scan for Old Teams
            </button>

            {orphanPreview && Array.isArray(orphanPreview.orphanIds) && orphanPreview.orphanIds.length > 0 ? (
              <div className="space-y-2 border-t border-amber-500/20 pt-3">
                <p className="text-xs font-semibold text-amber-100">Teams to remove: {orphanPreview.orphanIds.join(", ")}</p>
                <p className="text-xs text-slate-400">Affected players: {orphanPreview.affectedUserCount ?? 0}</p>

                {Array.isArray(orphanPreview.affectedUsers) && orphanPreview.affectedUsers.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {orphanPreview.affectedUsers.slice(0, 10).map((user) => (
                      <div key={user.uid} className="rounded-lg border border-slate-800/60 bg-slate-950/50 px-3 py-2 text-xs">
                        <div className="text-slate-200">{user.displayName}</div>
                        <div className="text-slate-500">{user.teamIds.join(", ")}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <label className="block text-xs text-slate-300">
                  Type <span className="text-amber-200 font-mono">DELETE ORPHAN TEAMS</span> to confirm
                  <input
                    value={orphanConfirmation}
                    onChange={(e) => setOrphanConfirmation(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void confirmDeleteOrphanTeamDocs()}
                  disabled={!dangerConfirmed || orphanConfirmation !== "DELETE ORPHAN TEAMS"}
                  className="w-full px-4 py-2 rounded-xl border border-rose-500/60 text-rose-100 text-sm font-semibold hover:bg-rose-500/10 disabled:opacity-50"
                >
                  Confirm &amp; Remove
                </button>
              </div>
            ) : null}

            {orphanStatus ? <p className="text-xs text-slate-300 whitespace-pre-wrap">{orphanStatus}</p> : null}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function SeedTeamsPage() {
  return (
    <AdminShell title="Team Setup" subtitle="Load all 48 teams into the database and remove obsolete team docs." wide>
      <AdminGate>{({ uid }) => <SeedTeamsContent uid={uid} />}</AdminGate>
    </AdminShell>
  );
}
