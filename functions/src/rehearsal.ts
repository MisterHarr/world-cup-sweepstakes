import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "./auth";
import {
  getErrorMessage,
  recordIngestAttempt,
  recordIngestSuccess,
  recordIngestError,
} from "./ingestHealth";
import { getLocalLiveSimulatorWave } from "./providers/localLiveSimulatorProvider";
import { getFixtureReplayWave } from "./providers/fixtureReplayProvider";
import { applyNormalizedMatchUpdates, writeLiveOpsHealth } from "./ingest";

const REGION = "asia-southeast1";

type PublicRehearsalResetResult = {
  deletedMatches: number;
  deletedTransferEvents: number;
  resetUsers: number;
  resetTeams: number;
  deletedLeaderboard: boolean;
};

async function countCollectionDocs(collectionName: string): Promise<number> {
  const db = admin.firestore();
  const snap = await db.collection(collectionName).count().get();
  return snap.data().count;
}

async function deleteCollectionDocs(collectionName: string): Promise<number> {
  const db = admin.firestore();
  let deleted = 0;

  while (true) {
    const snap = await db.collection(collectionName).limit(400).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      deleted += 1;
    });
    await batch.commit();
  }

  return deleted;
}

async function resetPublicRehearsalState(): Promise<PublicRehearsalResetResult> {
  const db = admin.firestore();
  const [deletedMatches, deletedTransferEvents] = await Promise.all([
    deleteCollectionDocs("matches"),
    deleteCollectionDocs("transferEvents"),
  ]);

  const [usersSnap, teamsSnap, leaderboardSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("teams").get(),
    db.collection("leaderboard").doc("current").get(),
  ]);

  const maxBatch = 450;
  let batch = db.batch();
  let writes = 0;
  const commitIfFull = async () => {
    if (writes < maxBatch) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const teamDoc of teamsSnap.docs) {
    batch.set(
      teamDoc.ref,
      {
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        cleanSheets: 0,
        redCards: 0,
        yellowCards: 0,
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    writes += 1;
    await commitIfFull();
  }

  for (const userDoc of usersSnap.docs) {
    batch.set(
      userDoc.ref,
      {
        totalScore: 0,
        transferPenaltyPoints: 0,
        scoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    writes += 1;
    await commitIfFull();
  }

  if (leaderboardSnap.exists) {
    batch.delete(leaderboardSnap.ref);
    writes += 1;
    await commitIfFull();
  }

  batch.delete(db.collection("ingestHealth").doc("current"));
  writes += 1;
  await commitIfFull();

  batch.set(
    db.collection("settings").doc("liveSimulator"),
    {
      nextWave: 0,
      totalWaves: 4,
      lastResetAt: FieldValue.serverTimestamp(),
      lastAppliedWave: null,
      lastLabel: null,
      done: false,
    },
    { merge: true }
  );
  writes += 1;

  if (writes > 0) {
    await batch.commit();
  }

  return {
    deletedMatches,
    deletedTransferEvents,
    resetUsers: usersSnap.size,
    resetTeams: teamsSnap.size,
    deletedLeaderboard: leaderboardSnap.exists,
  };
}

export const adminResetPublicRehearsalState = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const dryRun = request.data?.dryRun === true;
    const [matches, transferEvents, users, teams] = await Promise.all([
      countCollectionDocs("matches"),
      countCollectionDocs("transferEvents"),
      countCollectionDocs("users"),
      countCollectionDocs("teams"),
    ]);

    if (dryRun) {
      const leaderboardSnap = await admin
        .firestore()
        .collection("leaderboard")
        .doc("current")
        .get();
      return {
        ok: true,
        dryRun: true,
        willDeleteMatches: matches,
        willDeleteTransferEvents: transferEvents,
        willResetUsers: users,
        willResetTeams: teams,
        willDeleteLeaderboard: leaderboardSnap.exists,
      };
    }

    const result = await resetPublicRehearsalState();
    await writeLiveOpsHealth({
      mode: "production",
      provider: "fixture",
      matches: 0,
      updated: 0,
      errorMessage: null,
    });

    return {
      ok: true,
      ...result,
    };
  }
);

export const adminRunLocalLiveSimulatorWave = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const db = admin.firestore();
    const stateRef = db.collection("settings").doc("liveSimulator");
    const stateSnap = await stateRef.get();
    const state = (stateSnap.exists ? stateSnap.data() : {}) as Record<string, unknown>;
    const requestedWave = Number(request.data?.waveIndex);
    const storedNextWave =
      typeof state.nextWave === "number" && Number.isFinite(state.nextWave)
        ? Math.floor(state.nextWave)
        : 0;
    const waveIndex = Number.isFinite(requestedWave)
      ? Math.max(0, Math.floor(requestedWave))
      : storedNextWave;
    const wave = getLocalLiveSimulatorWave({ waveIndex });

    await recordIngestAttempt({
      activeProvider: "local-live-sim",
      mode: "production",
    });

    try {
      const result = await applyNormalizedMatchUpdates(wave.updates, {
        source: "fixture",
        initiatedBy: request.auth?.uid ?? "admin",
        collectionName: "matches",
        recompute: true,
        recomputeTarget: "public",
      });

      await stateRef.set(
        {
          nextWave: wave.done ? wave.totalWaves - 1 : wave.waveIndex + 1,
          totalWaves: wave.totalWaves,
          lastAppliedWave: wave.waveIndex,
          lastLabel: wave.label,
          done: wave.done,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: request.auth?.uid ?? "admin",
        },
        { merge: true }
      );

      await writeLiveOpsHealth({
        mode: "production",
        provider: "fixture",
        matches: result.matches,
        updated: result.updated,
        errorMessage: null,
      });
      await recordIngestSuccess({
        activeProvider: "local-live-sim",
        mode: "production",
      });

      return {
        ok: true,
        waveIndex: wave.waveIndex,
        label: wave.label,
        totalWaves: wave.totalWaves,
        done: wave.done,
        nextWave: wave.done ? wave.totalWaves - 1 : wave.waveIndex + 1,
        ...result,
      };
    } catch (err) {
      const message = getErrorMessage(err);
      await writeLiveOpsHealth({
        mode: "production",
        provider: "fixture",
        errorMessage: message,
      });
      await recordIngestError({
        activeProvider: "local-live-sim",
        errorMessage: message,
        mode: "production",
      });
      throw err;
    }
  }
);

export const adminReplayFixtureWave = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const db = admin.firestore();
    const stateRef = db.collection("settings").doc("fixtureReplay");
    const stateSnap = await stateRef.get();
    const state = (stateSnap.exists ? stateSnap.data() : {}) as Record<string, unknown>;

    const requestedCursor = Number(request.data?.cursor);
    const cursor = Number.isFinite(requestedCursor)
      ? Math.max(0, Math.floor(requestedCursor))
      : typeof state.cursor === "number" && Number.isFinite(state.cursor)
      ? Math.max(0, Math.floor(state.cursor))
      : 0;

    const requestedWaveSize = Number(request.data?.waveSize);
    const waveSize = Number.isFinite(requestedWaveSize)
      ? Math.max(1, Math.floor(requestedWaveSize))
      : 4;

    const wave = getFixtureReplayWave({ cursor, waveSize });
    const result = await applyNormalizedMatchUpdates(wave.updates, {
      source: "fixture",
      initiatedBy: request.auth?.uid ?? "admin",
      collectionName: "shadowMatches",
      recompute: false,
    });

    await stateRef.set(
      {
        cursor: wave.nextCursor,
        waveSize,
        total: wave.total,
        done: wave.done,
        lastRunAt: FieldValue.serverTimestamp(),
        lastRunBy: request.auth?.uid ?? "admin",
      },
      { merge: true }
    );

    return {
      ok: true,
      applied: result.updated,
      matches: result.matches,
      quarantined: result.quarantined,
      cursor,
      nextCursor: wave.nextCursor,
      total: wave.total,
      done: wave.done,
      target: "shadowMatches",
    };
  }
);

export const adminResetFixtureReplay = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const db = admin.firestore();
    let deleted = 0;

    while (true) {
      const snap = await db.collection("shadowMatches").limit(400).get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        deleted += 1;
      });
      await batch.commit();
    }

    await db.collection("settings").doc("fixtureReplay").set(
      {
        cursor: 0,
        waveSize: null,
        total: null,
        done: false,
        lastResetAt: FieldValue.serverTimestamp(),
        lastResetBy: request.auth?.uid ?? "admin",
      },
      { merge: true }
    );

    return {
      ok: true,
      deleted,
      cursor: 0,
      target: "shadowMatches",
    };
  }
);
