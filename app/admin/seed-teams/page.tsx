"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import {
  doc,
  setDoc,
  serverTimestamp,
  type WithFieldValue,
} from "firebase/firestore";

import { AdminEnvironmentBadge } from "@/components/admin/AdminEnvironmentBadge";
import { AdminGate } from "@/components/admin/AdminGate";
import { LocalhostProductionWarning } from "@/components/admin/LocalhostProductionWarning";
import { db, functions } from "@/lib/firebase";
import { TEAMS_SEED } from "@/lib/seed/teamsSeed";
import type { Team } from "@/types";

type TeamSeedDocument = Team & {
  teamId: string;
  updatedAt: unknown;
};

type OrphanPreviewResponse = {
  ok?: boolean;
  orphanIds?: string[];
  orphanCount?: number;
  deleted?: number;
  affectedUserCount?: number;
  affectedUsers?: Array<{
    uid: string;
    displayName: string;
    email: string;
    teamIds: string[];
  }>;
};

type OrphanDeletePayload = {
  allowedTeamIds: string[];
  confirmationText: string;
};

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return String(error);
}

const ALLOWED_TEAM_IDS = new Set(TEAMS_SEED.map((team) => team.id));

function SeedTeamsContent(props: { uid: string }) {
  const { uid } = props;
  const [status, setStatus] = useState("");
  const [orphanStatus, setOrphanStatus] = useState("");
  const [orphanPreview, setOrphanPreview] = useState<OrphanPreviewResponse | null>(
    null
  );
  const [orphanConfirmation, setOrphanConfirmation] = useState("");
  const [dangerConfirmed, setDangerConfirmed] = useState(false);
  const teamCount = useMemo(() => TEAMS_SEED.length, []);

  async function seedTeams() {
    setStatus("Seeding teams...");

    try {
      for (const team of TEAMS_SEED) {
        const payload: WithFieldValue<TeamSeedDocument> = {
          ...team,
          teamId: team.id,
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, "teams", team.id), payload, { merge: true });
      }

      setStatus(
        `✅ Successfully wrote ${teamCount} team documents (setDoc merge). ` +
          `Retired ids (e.g. PO_*) are not removed automatically — use the orphan button below if needed.`
      );
    } catch (error: unknown) {
      console.error(error);
      setStatus(`❌ ${asErrorMessage(error)}`);
    }
  }

  async function deleteOrphanTeamDocs() {
    setOrphanStatus("Scanning teams collection…");

    try {
      const fn = httpsCallable<{ allowedTeamIds: string[] }, OrphanPreviewResponse>(
        functions,
        "adminPreviewOrphanTeamDeletion"
      );
      const res = await fn({ allowedTeamIds: TEAMS_SEED.map((team) => team.id) });
      const data = res.data;
      setOrphanPreview(data);

      const orphanIds = Array.isArray(data.orphanIds) ? data.orphanIds : [];
      const affectedUserCount = Number(data.affectedUserCount ?? 0);
      if (orphanIds.length === 0) {
        setOrphanStatus(
          "✅ No orphan documents — every teams/{id} matches TEAMS_SEED."
        );
        return;
      }

      setOrphanStatus(
        `⚠️ Found ${orphanIds.length} orphan team doc(s). ` +
          `Affected users: ${affectedUserCount}. Review below, then type DELETE ORPHAN TEAMS to proceed.`
      );
    } catch (error: unknown) {
      console.error(error);
      setOrphanStatus(`❌ ${asErrorMessage(error)}`);
    }
  }

  async function confirmDeleteOrphanTeamDocs() {
    setOrphanStatus("Deleting orphan team docs...");

    try {
      const fn = httpsCallable<OrphanDeletePayload, OrphanPreviewResponse>(
        functions,
        "adminDeleteOrphanTeamDocs"
      );
      const res = await fn({
        allowedTeamIds: TEAMS_SEED.map((team) => team.id),
        confirmationText: orphanConfirmation,
      });
      const data = res.data;
      const orphanIds = Array.isArray(data.orphanIds) ? data.orphanIds : [];
      setOrphanStatus(
        `✅ Deleted ${Number(data.deleted ?? orphanIds.length)} orphan document(s): ${orphanIds.join(", ")}. ` +
          `Affected users at deletion time: ${Number(data.affectedUserCount ?? 0)}.`
      );
      setOrphanPreview(null);
      setOrphanConfirmation("");
    } catch (error: unknown) {
      console.error(error);
      setOrphanStatus(`❌ ${asErrorMessage(error)}`);
    }
  }

  return (
    <>
      <div className="text-sm text-slate-300">
        Signed in as <strong>{uid}</strong>
      </div>

      <LocalhostProductionWarning onConfirmedChange={setDangerConfirmed} />

      <div className="text-sm">
        <a href="/admin/fixtures" className="text-emerald-200 underline">
          Go to Fixture Ingest
        </a>
      </div>

      <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300 space-y-2">
        <p>
          <strong>1. Seed Teams</strong> — writes <strong>{teamCount}</strong>{" "}
          documents to <code className="text-emerald-200/90">teams/{`{teamId}`}</code>{" "}
          using <code className="text-emerald-200/90">setDoc(..., merge: true)</code>.
          Existing fields on a doc are merged; this does <strong>not</strong> delete
          retired ids (e.g. old playoff placeholders).
        </p>
        <p>
          <strong>2. Remove orphan team docs</strong> (after a roster change) —
          deletes any <code className="text-emerald-200/90">teams/{`{id}`}</code>{" "}
          whose <code className="text-emerald-200/90">id</code> is not in the
          current <code className="text-emerald-200/90">TEAMS_SEED</code> list in
          this app build.
        </p>
        <p className="text-slate-400 text-xs">
          Test on emulator or staging first. Production: coordinate so no active
          users still reference a deleted team id. This tool now previews affected
          users before deletion and requires typed confirmation.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={seedTeams}
          disabled={!dangerConfirmed}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
        >
          Seed Teams
        </button>
        <button
          type="button"
          onClick={() => void deleteOrphanTeamDocs()}
          disabled={!dangerConfirmed}
          className="w-full sm:w-auto px-4 py-2 rounded-xl border border-amber-500/60 text-amber-100 font-semibold hover:bg-amber-500/10 disabled:opacity-50"
        >
          Remove orphan team docs
        </button>
      </div>

      {orphanPreview && Array.isArray(orphanPreview.orphanIds) && orphanPreview.orphanIds.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-slate-300 space-y-3">
          <div className="font-semibold text-amber-100">
            Orphan Deletion Preview
          </div>
          <div>Orphan ids: {orphanPreview.orphanIds.join(", ")}</div>
          <div>Affected users: {Number(orphanPreview.affectedUserCount ?? 0)}</div>
          {Array.isArray(orphanPreview.affectedUsers) && orphanPreview.affectedUsers.length > 0 ? (
            <div className="space-y-2">
              {orphanPreview.affectedUsers.slice(0, 10).map((user) => (
                <div
                  key={user.uid}
                  className="rounded-lg border border-slate-800/60 bg-slate-950/50 p-3"
                >
                  <div className="text-slate-100">{user.displayName}</div>
                  <div className="text-xs text-slate-400">{user.email}</div>
                  <div className="text-xs text-slate-500">
                    References: {user.teamIds.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <label className="block text-sm text-slate-300">
            Type <span className="text-amber-200">DELETE ORPHAN TEAMS</span> to confirm
            <input
              value={orphanConfirmation}
              onChange={(event) => setOrphanConfirmation(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <button
            type="button"
            onClick={() => void confirmDeleteOrphanTeamDocs()}
            disabled={!dangerConfirmed || orphanConfirmation !== "DELETE ORPHAN TEAMS"}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-rose-500/60 text-rose-100 font-semibold hover:bg-rose-500/10 disabled:opacity-50"
          >
            Delete Confirmed Orphan Teams
          </button>
        </div>
      ) : null}

      <div className="text-sm text-slate-300 space-y-1">
        <div>{status}</div>
        {orphanStatus ? (
          <div className="text-slate-400 border-t border-slate-800/60 pt-2 mt-2">
            {orphanStatus}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function SeedTeamsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
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
            <AdminEnvironmentBadge />
          </div>

          <AdminGate>{({ uid }) => <SeedTeamsContent uid={uid} />}</AdminGate>
        </div>
      </div>
    </div>
  );
}
