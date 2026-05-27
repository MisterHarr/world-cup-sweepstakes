import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { recomputeScoresCore } from "./scoring";
import { getAdminEnvironmentLabel, recordAdminEvent } from "./adminAudit";
import { isRecord } from "./providers/providerUtils";
import {
  asTrimmedString,
  drawTierBalanced,
  shuffle,
  uniqueByTeamId,
} from "./functionUtils";

import { CALL_OPTS } from "./runtimeConfig";

type SeedDepartmentMode =
  | "round-robin"
  | "random"
  | "primary"
  | "secondary"
  | "admin";

function hasAssignedTeams(user: unknown): boolean {
  const source = isRecord(user) ? user : {};
  const portfolio = Array.isArray(source.portfolio) ? source.portfolio : [];
  const hasFeaturedInPortfolio = portfolio.some((item) => {
    if (!isRecord(item)) return false;
    return (
      item.role === "featured" &&
      typeof item.teamId === "string" &&
      item.teamId.trim().length > 0
    );
  });

  const entry = isRecord(source.entry) ? source.entry : null;
  const featuredTeamId =
    entry && typeof entry.featuredTeamId === "string"
      ? entry.featuredTeamId
      : "";
  const hasFeaturedInEntry = featuredTeamId.trim().length > 0;

  return hasFeaturedInPortfolio || hasFeaturedInEntry;
}

function getAssignedTeamCount(user: unknown): number {
  const source = isRecord(user) ? user : {};
  const ids = new Set<string>();

  const portfolio = Array.isArray(source.portfolio) ? source.portfolio : [];
  portfolio.forEach((item) => {
    if (!isRecord(item)) return;
    if (typeof item.teamId === "string" && item.teamId.trim().length > 0) {
      ids.add(item.teamId.trim());
    }
  });

  const entry = isRecord(source.entry) ? source.entry : null;
  if (
    entry &&
    typeof entry.featuredTeamId === "string" &&
    entry.featuredTeamId.trim().length > 0
  ) {
    ids.add(entry.featuredTeamId.trim());
  }

  if (entry && Array.isArray(entry.drawnTeamIds)) {
    entry.drawnTeamIds.forEach((rawId: unknown) => {
      if (typeof rawId === "string" && rawId.trim().length > 0) {
        ids.add(rawId.trim());
      }
    });
  }

  return ids.size;
}

function asPositiveIntegerWithin(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function asSeedDepartmentMode(value: unknown): SeedDepartmentMode | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toLowerCase();
  if (
    token === "round-robin" ||
    token === "random" ||
    token === "primary" ||
    token === "secondary" ||
    token === "admin"
  ) {
    return token;
  }
  return null;
}

function sanitizeSeedToken(value: string): string {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return token.length > 0 ? token : "seed";
}

function sanitizeEmailDomain(value: string): string {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\.+/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "");
  if (!token) return "example.test";
  return token.includes(".") ? token : `${token}.test`;
}

function pickDepartmentForSeed(
  index: number,
  mode: SeedDepartmentMode
): "Primary" | "Secondary" | "Admin" {
  const departments: Array<"Primary" | "Secondary" | "Admin"> = [
    "Primary",
    "Secondary",
    "Admin",
  ];
  if (mode === "primary") return "Primary";
  if (mode === "secondary") return "Secondary";
  if (mode === "admin") return "Admin";
  if (mode === "random") {
    return departments[Math.floor(Math.random() * departments.length)];
  }
  return departments[index % departments.length];
}

export const adminListUsers = onCall(CALL_OPTS, async (request) => {
  const isAdmin = request.auth?.token?.admin === true;
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const db = admin.firestore();
  try {
    const usersSnap = await db.collection("users").orderBy("email").get();

    const users = usersSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const hasTeams = hasAssignedTeams(data);
      const teamCount = getAssignedTeamCount(data);

      return {
        uid: doc.id,
        displayName: asTrimmedString(data.displayName) ?? "Unknown",
        email: asTrimmedString(data.email) ?? "",
        hasTeams,
        teamCount,
        isMock: data.isMock === true,
        mockBatchId: asTrimmedString(data.mockBatchId) ?? "",
      };
    });

    return {
      ok: true,
      users,
    };
  } catch (err: unknown) {
    console.error("adminListUsers error:", err);
    throw new HttpsError("internal", "Failed to list users.");
  }
});

export const adminAssignTeamsToUser = onCall(CALL_OPTS, async (request) => {
  const isAdmin = request.auth?.token?.admin === true;
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const requestData = isRecord(request.data) ? request.data : {};
  const targetUidRaw = requestData.userId;
  if (typeof targetUidRaw !== "string" || targetUidRaw.trim().length === 0) {
    throw new HttpsError("invalid-argument", "userId must be provided.");
  }
  const targetUid = targetUidRaw.trim();

  const db = admin.firestore();
  const userRef = db.collection("users").doc(targetUid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  const user = userSnap.data() as Record<string, unknown>;
  const hasTeams = hasAssignedTeams(user);
  if (hasTeams) {
    return { ok: true, message: "User already has teams assigned.", skipped: true };
  }

  type TeamPoolRow = {
    id: string;
    name: string;
    tier: number;
  };

  const teamsSnap = await db.collection("teams").get();
  const allTeams = uniqueByTeamId(
    teamsSnap.docs
      .map((d): TeamPoolRow | null => {
        const data = d.data() as Record<string, unknown>;
        const id = asTrimmedString(data.id) ?? d.id;
        const name = asTrimmedString(data.name);
        const tierRaw = data.tier;
        const tier =
          typeof tierRaw === "number" && Number.isFinite(tierRaw)
            ? Math.floor(tierRaw)
            : null;
        if (!id || !name || tier === null || tier < 1 || tier > 4) return null;
        return { id, name, tier };
      })
      .filter((team): team is TeamPoolRow => team !== null)
  );

  if (allTeams.length < 6) {
    throw new HttpsError("failed-precondition", "Not enough teams in database.");
  }

  const shuffledTeams = shuffle(allTeams);
  const featuredTeam = shuffledTeams[0];
  const eligibleForDraw = shuffledTeams.slice(1);

  const drawnTeams = drawTierBalanced(eligibleForDraw, 5);
  if (drawnTeams.length < 5) {
    throw new HttpsError(
      "failed-precondition",
      "Not enough unique teams available for draw."
    );
  }

  const nextPortfolio = [
    { teamId: featuredTeam.id, role: "featured" as const },
    ...drawnTeams.map((t) => ({
      teamId: t.id,
      role: "drawn" as const,
    })),
  ];

  const entry = {
    confirmedAt: FieldValue.serverTimestamp(),
    featuredTeamId: featuredTeam.id,
    drawnTeamIds: drawnTeams.map((t) => t.id),
    version: 1,
  };

  await userRef.update({
    entry,
    portfolio: nextPortfolio,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    message: `Assigned ${featuredTeam.name} (featured) + 5 drawn teams.`,
    featured: featuredTeam.name,
    drawn: drawnTeams.map((t) => t.name),
  };
});

export const adminSeedMockUsers = onCall(CALL_OPTS, async (request) => {
  const isAdmin = request.auth?.token?.admin === true;
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const payload = isRecord(request.data) ? request.data : {};
  const count = asPositiveIntegerWithin(payload.count, 24, 1, 60);
  const password =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    "!";
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "password must be at least 6 characters.");
  }

  const prefix = sanitizeSeedToken(asTrimmedString(payload.prefix) ?? "wcpseed");
  const domain = sanitizeEmailDomain(asTrimmedString(payload.domain) ?? "example.test");
  const departmentMode = asSeedDepartmentMode(payload.departmentMode) ?? "round-robin";
  const recompute = payload.recompute !== false;
  const excludeMockUsersFromLeaderboard =
    payload.excludeMockUsersFromLeaderboard !== false;
  const batchTag =
    sanitizeSeedToken(asTrimmedString(payload.batchTag) ?? new Date().toISOString());
  const actorUid = request.auth?.uid ?? "admin";
  const actorEmail =
    typeof request.auth?.token?.email === "string" ? request.auth.token.email : null;
  const environment = getAdminEnvironmentLabel();

  type TeamPoolRow = {
    id: string;
    name: string;
    tier: number;
  };

  const db = admin.firestore();
  const teamsSnap = await db.collection("teams").get();
  const allTeams = uniqueByTeamId(
    teamsSnap.docs
      .map((d): TeamPoolRow | null => {
        const data = d.data() as Record<string, unknown>;
        const id = asTrimmedString(data.id) ?? d.id;
        const name = asTrimmedString(data.name);
        const tierRaw = data.tier;
        const tier =
          typeof tierRaw === "number" && Number.isFinite(tierRaw)
            ? Math.floor(tierRaw)
            : null;
        if (!id || !name || tier === null || tier < 1 || tier > 4) return null;
        return { id, name, tier };
      })
      .filter((team): team is TeamPoolRow => team !== null)
  );

  if (allTeams.length < 6) {
    throw new HttpsError("failed-precondition", "Not enough teams in database.");
  }

  const created: Array<{
    uid: string;
    email: string;
    displayName: string;
    department: "Primary" | "Secondary" | "Admin";
  }> = [];
  const failed: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < count; i += 1) {
    const ordinal = i + 1;
    const displayName = `WCP Seed User ${ordinal}`;
    const suffix = Math.random().toString(36).slice(2, 8);
    const email =
      `${prefix}_${batchTag}_${String(ordinal).padStart(2, "0")}_${suffix}@${domain}`.toLowerCase();
    const department = pickDepartmentForSeed(i, departmentMode);

    try {
      const authUser = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      });

      const shuffledTeams = shuffle(allTeams);
      const featuredTeam = shuffledTeams[0];
      const drawnTeams = drawTierBalanced(shuffledTeams.slice(1), 5);

      if (drawnTeams.length < 5) {
        throw new Error("Not enough unique teams available for draw.");
      }

      const nextPortfolio = [
        { teamId: featuredTeam.id, role: "featured" as const },
        ...drawnTeams.map((team) => ({ teamId: team.id, role: "drawn" as const })),
      ];

      const entry = {
        confirmedAt: FieldValue.serverTimestamp(),
        featuredTeamId: featuredTeam.id,
        drawnTeamIds: drawnTeams.map((team) => team.id),
        version: 1,
      };

      await db.collection("users").doc(authUser.uid).set(
        {
          uid: authUser.uid,
          displayName,
          email,
          photoURL: null,
          isAdmin: false,
          department,
          hasSeenReveal: true,
          remainingTransfers: 1,
          transferPenaltyPoints: 0,
          totalScore: 0,
          isMock: true,
          mockBatchId: batchTag,
          createdByAdminUid: actorUid,
          entry,
          portfolio: nextPortfolio,
          mockSeed: {
            batchTag,
            index: ordinal,
            createdBy: actorUid,
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      created.push({
        uid: authUser.uid,
        email,
        displayName,
        department,
      });
    } catch (err: unknown) {
      const reason =
        err instanceof Error && err.message.trim().length > 0
          ? err.message.trim()
          : "Failed to create seed user.";
      failed.push({ index: ordinal, reason });
    }
  }

  let recomputed = false;
  await db.collection("settings").doc("mockUsers").set(
    {
      excludeMockUsersFromLeaderboard,
      lastBatchId: batchTag,
      updatedBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (recompute && created.length > 0) {
    await recomputeScoresCore({
      includeLive: true,
      scoringVersion: "v1",
      initiatedBy: request.auth?.uid ?? "admin",
    });
    recomputed = true;
  }

  await recordAdminEvent({
    actorUid,
    actorEmail,
    action: "seed-mock-users",
    targetIds: created.map((entry) => entry.uid),
    summary:
      `Seeded mock users batch ${batchTag}. Created ${created.length}, failed ${failed.length}, ` +
      `excludeFromLeaderboard=${excludeMockUsersFromLeaderboard}, environment=${environment}.`,
    metadata: {
      batchTag,
      countRequested: count,
      created: created.length,
      failed: failed.length,
      departmentMode,
      excludeMockUsersFromLeaderboard,
      recomputed,
      environment,
    },
  });

  return {
    ok: true,
    batchTag,
    countRequested: count,
    created: created.length,
    failed: failed.length,
    password,
    departmentMode,
    excludeMockUsersFromLeaderboard,
    recomputed,
    sampleUsers: created.slice(0, 12),
    errors: failed.slice(0, 12),
  };
});
