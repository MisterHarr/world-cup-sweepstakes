import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAdmin } from "./auth";
import { recordAdminEvent } from "./adminAudit";
import { recomputeScoresCore } from "./scoring";

const REGION = "asia-southeast1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function readUserTeamRefs(user: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  const portfolio = Array.isArray(user.portfolio) ? user.portfolio : [];
  portfolio.forEach((entry) => {
    if (!isRecord(entry)) return;
    const teamId = asTrimmedString(entry.teamId);
    if (teamId) refs.add(teamId);
  });

  const entry = isRecord(user.entry) ? user.entry : null;
  const featured = asTrimmedString(entry?.featuredTeamId);
  if (featured) refs.add(featured);
  const drawn = Array.isArray(entry?.drawnTeamIds) ? entry.drawnTeamIds : [];
  drawn.forEach((teamId) => {
    const normalized = asTrimmedString(teamId);
    if (normalized) refs.add(normalized);
  });

  return Array.from(refs);
}

export const adminDeleteMockUsersByBatch = onCall({ region: REGION }, async (request) => {
  const auth = requireAdmin(request);
  const payload = isRecord(request.data) ? request.data : {};
  const batchId = asTrimmedString(payload.batchId);
  const dryRun = payload.dryRun === true;

  if (!batchId) {
    throw new HttpsError("invalid-argument", "batchId is required.");
  }

  const db = admin.firestore();
  const usersSnap = await db
    .collection("users")
    .where("isMock", "==", true)
    .where("mockBatchId", "==", batchId)
    .get();

  const targetUsers = usersSnap.docs.map((docSnap) => ({
    uid: docSnap.id,
    email: asTrimmedString(docSnap.data().email) ?? "",
  }));

  if (dryRun) {
    return {
      ok: true,
      batchId,
      dryRun: true,
      mockUsers: targetUsers.length,
      targetIds: targetUsers.map((user) => user.uid),
    };
  }

  for (const user of targetUsers) {
    await db.collection("users").doc(user.uid).delete();
    try {
      await admin.auth().deleteUser(user.uid);
    } catch (err) {
      console.error("deleteUser failed for mock cleanup", user.uid, err);
    }
  }

  await db.collection("settings").doc("mockUsers").set(
    {
      lastDeletedBatchId: batchId,
      updatedBy: auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (targetUsers.length > 0) {
    await recomputeScoresCore({
      includeLive: true,
      scoringVersion: "v1",
      initiatedBy: auth.uid,
    });
  }

  await recordAdminEvent({
    actorUid: auth.uid,
    actorEmail: typeof auth.token.email === "string" ? auth.token.email : null,
    action: "delete-mock-users-by-batch",
    targetIds: targetUsers.map((user) => user.uid),
    summary: `Deleted ${targetUsers.length} mock users from batch ${batchId}.`,
    metadata: {
      batchId,
      deletedCount: targetUsers.length,
      emails: targetUsers.map((user) => user.email).filter(Boolean),
    },
  });

  return {
    ok: true,
    batchId,
    deleted: targetUsers.length,
    targetIds: targetUsers.map((user) => user.uid),
  };
});

export const adminPreviewOrphanTeamDeletion = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);
    const payload = isRecord(request.data) ? request.data : {};
    const allowedTeamIds = Array.isArray(payload.allowedTeamIds)
      ? uniqueStrings(
          payload.allowedTeamIds
            .map((teamId) => asTrimmedString(teamId))
            .filter((teamId): teamId is string => Boolean(teamId))
        )
      : [];

    if (allowedTeamIds.length === 0) {
      throw new HttpsError("invalid-argument", "allowedTeamIds is required.");
    }

    const allowed = new Set(allowedTeamIds);
    const db = admin.firestore();
    const [teamsSnap, usersSnap] = await Promise.all([
      db.collection("teams").get(),
      db.collection("users").get(),
    ]);

    const orphanIds = teamsSnap.docs
      .map((docSnap) => docSnap.id)
      .filter((teamId) => !allowed.has(teamId))
      .sort();
    const orphanSet = new Set(orphanIds);

    const affectedUsers = usersSnap.docs
      .map((docSnap) => {
        const user = docSnap.data() as Record<string, unknown>;
        const refs = readUserTeamRefs(user).filter((teamId) => orphanSet.has(teamId));
        if (refs.length === 0) return null;
        return {
          uid: docSnap.id,
          email: asTrimmedString(user.email) ?? "",
          displayName: asTrimmedString(user.displayName) ?? "Unknown",
          teamIds: refs,
        };
      })
      .filter((entry): entry is {
        uid: string;
        email: string;
        displayName: string;
        teamIds: string[];
      } => entry !== null);

    return {
      ok: true,
      orphanIds,
      orphanCount: orphanIds.length,
      affectedUserCount: affectedUsers.length,
      affectedUsers: affectedUsers.slice(0, 25),
    };
  }
);

export const adminDeleteOrphanTeamDocs = onCall({ region: REGION }, async (request) => {
  const auth = requireAdmin(request);
  const payload = isRecord(request.data) ? request.data : {};
  const allowedTeamIds = Array.isArray(payload.allowedTeamIds)
    ? uniqueStrings(
        payload.allowedTeamIds
          .map((teamId) => asTrimmedString(teamId))
          .filter((teamId): teamId is string => Boolean(teamId))
      )
    : [];
  const confirmationText = asTrimmedString(payload.confirmationText);

  if (allowedTeamIds.length === 0) {
    throw new HttpsError("invalid-argument", "allowedTeamIds is required.");
  }
  if (confirmationText !== "DELETE ORPHAN TEAMS") {
    throw new HttpsError(
      "failed-precondition",
      "Type DELETE ORPHAN TEAMS to confirm orphan team deletion."
    );
  }

  const allowed = new Set(allowedTeamIds);
  const db = admin.firestore();
  const [teamsSnap, usersSnap] = await Promise.all([
    db.collection("teams").get(),
    db.collection("users").get(),
  ]);

  const orphanIds = teamsSnap.docs
    .map((docSnap) => docSnap.id)
    .filter((teamId) => !allowed.has(teamId))
    .sort();
  const orphanSet = new Set(orphanIds);

  const affectedUsers = usersSnap.docs
    .map((docSnap) => {
      const user = docSnap.data() as Record<string, unknown>;
      const refs = readUserTeamRefs(user).filter((teamId) => orphanSet.has(teamId));
      if (refs.length === 0) return null;
      return { uid: docSnap.id, teamIds: refs };
    })
    .filter((entry): entry is { uid: string; teamIds: string[] } => entry !== null);

  if (orphanIds.length === 0) {
    return {
      ok: true,
      deleted: 0,
      orphanIds: [],
      affectedUserCount: 0,
    };
  }

  const batch = db.batch();
  orphanIds.forEach((teamId) => {
    batch.delete(db.collection("teams").doc(teamId));
  });
  await batch.commit();

  await recordAdminEvent({
    actorUid: auth.uid,
    actorEmail: typeof auth.token.email === "string" ? auth.token.email : null,
    action: "delete-orphan-team-docs",
    targetIds: orphanIds,
    summary:
      `Deleted ${orphanIds.length} orphan team docs. ` +
      `Affected user count at deletion time: ${affectedUsers.length}.`,
    metadata: {
      orphanIds,
      affectedUserCount: affectedUsers.length,
      affectedUsers: affectedUsers.slice(0, 25),
    },
  });

  return {
    ok: true,
    deleted: orphanIds.length,
    orphanIds,
    affectedUserCount: affectedUsers.length,
  };
});
