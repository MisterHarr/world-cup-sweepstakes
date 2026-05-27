import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { isRecord } from "./providers/providerUtils";
import {
  asTrimmedString,
  drawTierBalanced,
  shuffle,
  uniqueByTeamId,
  type TeamSeedRow,
} from "./functionUtils";

import { CALL_OPTS } from "./runtimeConfig";

type PortfolioItem = { teamId: string; role: "featured" | "drawn" };

const ALLOWED_DEPARTMENTS = ["Primary", "Secondary", "Admin"] as const;
type Department = (typeof ALLOWED_DEPARTMENTS)[number];

function asNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

function hasErrorCode(value: unknown): value is { code: unknown } {
  return isRecord(value) && "code" in value;
}

function readPortfolio(value: unknown): PortfolioItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): PortfolioItem | null => {
      if (!isRecord(item)) return null;
      const teamId = asTrimmedString(item.teamId);
      const role =
        item.role === "featured" || item.role === "drawn" ? item.role : null;
      if (!teamId || !role) return null;
      return { teamId, role };
    })
    .filter((item): item is PortfolioItem => item !== null);
}

function readTeamSeedRow(value: unknown, fallbackId: string): TeamSeedRow | null {
  if (!isRecord(value)) return null;
  const id = asTrimmedString(value.id) ?? fallbackId;
  if (!id) return null;

  const name = asTrimmedString(value.name) ?? id;
  const group = asTrimmedString(value.group) ?? "";
  const tier =
    typeof value.tier === "number" && Number.isFinite(value.tier)
      ? Math.floor(value.tier)
      : 4;
  const flagUrl = asTrimmedString(value.flagUrl) ?? "";

  return { id, name, group, tier, flagUrl };
}

function buildUserBootstrapPatch(params: {
  uid: string;
  existing: Record<string, unknown>;
  authToken: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  includeCreatedAtIfMissing?: boolean;
}) {
  const { uid, existing, authToken, overrides = {}, includeCreatedAtIfMissing } =
    params;

  const displayName =
    asTrimmedString(overrides.displayName) ??
    asTrimmedString(existing.displayName) ??
    asTrimmedString(authToken.name) ??
    "Anonymous";

  const email =
    asTrimmedString(overrides.email) ??
    asTrimmedString(existing.email) ??
    asTrimmedString(authToken.email) ??
    "";

  const photoURL =
    asTrimmedString(overrides.photoURL) ??
    asTrimmedString(existing.photoURL) ??
    asTrimmedString(authToken.picture) ??
    null;

  const patch: Record<string, unknown> = {
    uid,
    displayName,
    email,
    photoURL,
    portfolio: Array.isArray(existing.portfolio) ? existing.portfolio : [],
    totalScore: asNonNegativeNumber(existing.totalScore) ?? 0,
    remainingTransfers: asNonNegativeNumber(existing.remainingTransfers) ?? 1,
    transferPenaltyPoints: asNonNegativeNumber(existing.transferPenaltyPoints) ?? 0,
    isAdmin:
      typeof existing.isAdmin === "boolean"
        ? existing.isAdmin
        : authToken.admin === true,
    hasSeenReveal:
      typeof existing.hasSeenReveal === "boolean" ? existing.hasSeenReveal : false,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (includeCreatedAtIfMissing && !existing.createdAt) {
    patch.createdAt = FieldValue.serverTimestamp();
  }

  return patch;
}

export const ensureUserProfile = onCall(CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const existing = (snap.exists ? snap.data() : {}) as Record<string, unknown>;
  const authToken = (request.auth?.token ?? {}) as Record<string, unknown>;
  const overrides =
    request.data && typeof request.data === "object"
      ? (request.data as Record<string, unknown>)
      : {};

  const patch = buildUserBootstrapPatch({
    uid,
    existing,
    authToken,
    overrides,
    includeCreatedAtIfMissing: true,
  });

  await userRef.set(patch, { merge: true });

  return {
    ok: true,
    created: !snap.exists,
  };
});

export const assignDrawnTeams = onCall(CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");

  const db = admin.firestore();

  // Read the static teams collection outside the transaction — 48 docs, never
  // mutated during onboarding, so there is no benefit to locking them inside
  // the transaction and it would only slow it down.
  const teamsSnap = await db.collection("teams").get();
  const allTeamIds = Array.from(
    new Set(
      teamsSnap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return asTrimmedString(data.id) ?? d.id;
        })
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    )
  );

  const userRef = db.collection("users").doc(uid);

  // Run the read → check → write as an atomic transaction so that two
  // simultaneous calls cannot both pass the "drawn < 5" guard and assign
  // duplicate teams.
  const picked = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "User profile missing.");
    }

    const user = userSnap.data() as Record<string, unknown>;
    const portfolio = readPortfolio(user.portfolio);

    const featured = portfolio.find((p) => p.role === "featured");
    if (!featured?.teamId) {
      throw new HttpsError("failed-precondition", "Select a Featured Team first.");
    }

    const existingDrawn = portfolio.filter((p) => p.role === "drawn");
    if (existingDrawn.length >= 5) {
      // Already fully assigned — idempotent success, no write needed.
      return null;
    }

    const exclude = new Set<string>([
      featured.teamId,
      ...existingDrawn.map((p) => p.teamId),
    ]);

    const candidates = allTeamIds.filter((id) => !exclude.has(id));
    if (candidates.length < 5) {
      throw new HttpsError(
        "failed-precondition",
        `Not enough teams to draw 5. Candidates=${candidates.length} TotalTeams=${allTeamIds.length}. Seed /admin/seed-teams (Firestore teams collection).`
      );
    }

    // Spread before shuffle so the original array is never mutated inside tx.
    const pickedIds = shuffle([...candidates]).slice(0, 5);

    const nextPortfolio = [
      { teamId: featured.teamId, role: "featured" as const },
      ...pickedIds.map((teamId) => ({ teamId, role: "drawn" as const })),
    ];

    tx.update(userRef, {
      portfolio: nextPortfolio,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return pickedIds;
  });

  if (picked === null) {
    return { ok: true, message: "Drawn teams already assigned." };
  }
  return { ok: true, picked };
});

export const confirmFeaturedTeam = onCall(CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const requestData = isRecord(request.data) ? request.data : {};
  const teamId = requestData.teamId;
  if (typeof teamId !== "string" || teamId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "teamId must be provided.");
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);

  const teamsSnap = await db.collection("teams").get();
  const allTeams = uniqueByTeamId(
    teamsSnap.docs
      .map((d): TeamSeedRow | null => {
        const data = d.data() as Record<string, unknown>;
        return readTeamSeedRow(data, d.id);
      })
      .filter((team): team is TeamSeedRow => team !== null)
  );

  const featuredTeam = allTeams.find((t) => t.id === teamId);
  if (!featuredTeam) {
    throw new HttpsError("not-found", "Selected team does not exist.");
  }

  const eligibleForDraw = allTeams.filter((t) => t.id !== teamId);
  if (eligibleForDraw.length < 5) {
    throw new HttpsError("failed-precondition", "Not enough teams to draw from.");
  }

  const drawnTeams = drawTierBalanced(eligibleForDraw, 5, featuredTeam.tier, featuredTeam.group);
  if (drawnTeams.length < 5) {
    throw new HttpsError(
      "failed-precondition",
      "Not enough unique teams available for draw."
    );
  }

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const user = (snap.exists ? snap.data() : {}) as Record<string, unknown>;
      const existingEntry = isRecord(user.entry) ? user.entry : null;

      if (existingEntry?.confirmedAt) {
        throw new HttpsError("failed-precondition", "Entry already confirmed.");
      }

      const portfolio = readPortfolio(user.portfolio);
      if (portfolio.some((p) => p.role === "featured")) {
        throw new HttpsError("failed-precondition", "Featured team already set.");
      }

      const now = FieldValue.serverTimestamp();
      const bootstrapPatch = buildUserBootstrapPatch({
        uid,
        existing: user,
        authToken: (request.auth?.token ?? {}) as Record<string, unknown>,
        includeCreatedAtIfMissing: true,
      });

      const nextPortfolio = [
        { teamId: featuredTeam.id, role: "featured" as const },
        ...drawnTeams.map((t) => ({
          teamId: t.id,
          role: "drawn" as const,
        })),
      ];

      const entry = {
        confirmedAt: now,
        featuredTeamId: featuredTeam.id,
        drawnTeamIds: drawnTeams.map((t) => t.id),
        version: 1,
      };

      tx.set(
        userRef,
        {
          ...bootstrapPatch,
          entry,
          portfolio: nextPortfolio,
          updatedAt: now,
        },
        { merge: true }
      );

      return {
        featured: featuredTeam,
        drawn: drawnTeams,
      };
    });

    return {
      ok: true,
      featured: result.featured,
      drawn: result.drawn,
    };
  } catch (err: unknown) {
    if (hasErrorCode(err)) throw err;
    console.error("confirmFeaturedTeam failed:", err);
    throw new HttpsError("internal", "Failed to confirm featured team.");
  }
});

export const setUsername = onCall(CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");

  const requestData = isRecord(request.data) ? request.data : {};
  const raw = asTrimmedString(requestData.username);

  if (!raw || raw.length < 2 || raw.length > 30) {
    throw new HttpsError(
      "invalid-argument",
      "Username must be between 2 and 30 characters."
    );
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);

  // Read user doc to enforce one-time setting
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "User profile not found.");
  }
  const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
  const isAdmin = request.auth?.token?.admin === true;

  if (userData.username && !isAdmin) {
    throw new HttpsError(
      "already-exists",
      "Display name already set. It can only be chosen once."
    );
  }

  // Case-insensitive duplicate check
  const rawLower = raw.toLowerCase();
  const dupSnap = await db
    .collection("users")
    .where("usernameLower", "==", rawLower)
    .limit(1)
    .get();

  const taken = dupSnap.docs.some((d) => d.id !== uid);
  if (taken) {
    throw new HttpsError(
      "already-exists",
      "That name is already taken — please choose another."
    );
  }

  await userRef.update({
    username: raw,
    usernameLower: rawLower,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Patch the leaderboard immediately so the name appears at once
  const lbRef = db.collection("leaderboard").doc("current");
  const lbSnap = await lbRef.get();
  if (lbSnap.exists) {
    const lbData = (lbSnap.data() ?? {}) as Record<string, unknown>;
    if (Array.isArray(lbData.rows)) {
      const updatedRows = (lbData.rows as Record<string, unknown>[]).map((row) =>
        row.userId === uid ? { ...row, displayName: raw } : row
      );
      await lbRef.update({ rows: updatedRows });
    }
  }

  return { ok: true, username: raw };
});

export const setDepartment = onCall(CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const department = request.data?.department as Department | undefined;
  if (!department || !ALLOWED_DEPARTMENTS.includes(department)) {
    throw new HttpsError(
      "invalid-argument",
      "Department must be Primary, Secondary, or Admin."
    );
  }

  const isAdmin = request.auth?.token?.admin === true;

  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const existing = (snap.exists ? snap.data() : {}) as Record<string, unknown>;
  const existingDept =
    typeof existing.department === "string" ? existing.department : null;

  if (existingDept && !isAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Department already set and cannot be changed."
    );
  }

  const bootstrapPatch = buildUserBootstrapPatch({
    uid,
    existing,
    authToken: (request.auth?.token ?? {}) as Record<string, unknown>,
    includeCreatedAtIfMissing: true,
  });

  await userRef.set(
    {
      ...bootstrapPatch,
      department,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    department,
    alreadySet: Boolean(existingDept),
    changedByAdmin: Boolean(existingDept && isAdmin),
  };
});
