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

// Hard registration cutoff — new user docs cannot be created on or after the
// opening match kickoff. Mexico vs South Africa, Estadio Azteca, 11 Jun 2026,
// 19:00 UTC (3 pm ET / 3 am MYT 12 Jun). Existing users are never affected.
const REGISTRATION_DEADLINE_MS = Date.parse("2026-06-11T19:00:00.000Z");

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

  // Block new registrations after the tournament has started.
  // Existing users (snap.exists === true) always pass through unaffected.
  if (!snap.exists && Date.now() >= REGISTRATION_DEADLINE_MS) {
    throw new HttpsError(
      "failed-precondition",
      "Registration is now closed — the tournament has already started."
    );
  }

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

  // Count how many times each team already appears across existing user
  // portfolios (any role).  drawTierBalanced uses these counts to prefer
  // teams that have been picked the fewest times — keeping the overall
  // distribution even as more players sign up.
  const appearanceCounts: Record<string, number> = {};
  try {
    const existingUsersSnap = await db.collection("users").get();
    existingUsersSnap.docs.forEach((userDoc) => {
      const data = userDoc.data() as Record<string, unknown>;
      const portfolio = Array.isArray(data.portfolio)
        ? (data.portfolio as Array<{ teamId?: unknown; role?: unknown }>)
        : [];
      portfolio.forEach((item) => {
        const id = typeof item?.teamId === "string" ? item.teamId : null;
        if (!id) return;
        appearanceCounts[id] = (appearanceCounts[id] ?? 0) + 1;
      });
    });
  } catch (err) {
    // Non-fatal — if we can't read the count, fall back to pure random draw.
    console.warn("confirmFeaturedTeam: unable to read appearance counts; using random draw:", err);
  }

  const drawnTeams = drawTierBalanced(
    eligibleForDraw,
    5,
    featuredTeam.tier,
    featuredTeam.group,
    appearanceCounts,
  );
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

    // Add the new user to leaderboard/current as a single row.
    //
    // A brand new user has 0 points and 0 goals — we don't need a full
    // recompute (which reads ~163 docs). Just append their row.  The full
    // recompute runs naturally on the next scheduler tick once the
    // tournament starts and will resync everything.
    //
    // Cost: 1 read + 1 write per signup (vs ~163 reads before).
    try {
      const db = admin.firestore();
      const lbRef = db.collection("leaderboard").doc("current");
      const userSnap = await db.collection("users").doc(uid).get();
      const userData = (userSnap.exists ? userSnap.data() : {}) as Record<string, unknown>;
      const displayName =
        (typeof userData.username === "string" && userData.username.trim()) ||
        (typeof userData.displayName === "string" && userData.displayName.trim()) ||
        "Player";
      const department = typeof userData.department === "string" ? userData.department : null;

      const lbSnap = await lbRef.get();
      if (lbSnap.exists) {
        const lbData = (lbSnap.data() ?? {}) as Record<string, unknown>;
        const rows = Array.isArray(lbData.rows)
          ? (lbData.rows as Record<string, unknown>[])
          : [];
        const alreadyPresent = rows.some((r) => r.userId === uid);
        if (!alreadyPresent) {
          // Find the correct rank for a new user with totalScore=0 & tiebreakGoals=0.
          // If there's already a row at the bottom with the same score+goals,
          // the new user shares that rank.  Otherwise they're placed at the end.
          const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
          const lastScore = typeof lastRow?.totalScore === "number" ? lastRow.totalScore : null;
          const lastGoals = typeof lastRow?.tiebreakGoals === "number" ? lastRow.tiebreakGoals : 0;
          const lastRank = typeof lastRow?.rank === "number" ? lastRow.rank : rows.length;
          const sharesRankWithLast = lastScore === 0 && lastGoals === 0;
          const newRank = sharesRankWithLast ? lastRank : rows.length + 1;

          const newRow = {
            userId: uid,
            displayName,
            totalScore: 0,
            tiebreakGoals: 0,
            badgeCount: 0,
            rank: newRank,
            department,
          };
          await lbRef.update({
            rows: [...rows, newRow],
            rowCount: rows.length + 1,
          });
        }
      } else {
        // Edge case — leaderboard doesn't exist yet. Create it.
        await lbRef.set({
          rows: [{
            userId: uid,
            displayName,
            totalScore: 0,
            tiebreakGoals: 0,
            badgeCount: 0,
            rank: 1,
            department,
          }],
          rowCount: 1,
        });
      }
    } catch (lbErr) {
      // Non-fatal — user is enrolled; next recompute will catch them.
      console.error("Post-onboarding leaderboard patch failed (non-fatal):", lbErr);
    }

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
  const rawLower = raw.toLowerCase();
  const userRef = db.collection("users").doc(uid);
  // Use lowercase as the document ID so uniqueness is case-insensitive.
  // usernames/{lowerName} → { uid } acts as an atomic ownership lock.
  const newLockRef = db.collection("usernames").doc(rawLower);
  const isAdminToken = request.auth?.token?.admin === true;

  // Atomically: read user doc + username lock → validate → write lock + user doc.
  // If two calls race to claim the same name, the second transaction will see the
  // lock document already written by the first and throw "username taken".
  await db.runTransaction(async (tx) => {
    const [userSnap, lockSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(newLockRef),
    ]);

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
    const existingUsername = asTrimmedString(userData.username);
    const existingLower = asTrimmedString(userData.usernameLower);

    if (existingUsername && !isAdminToken) {
      throw new HttpsError(
        "already-exists",
        "Display name already set. It can only be chosen once."
      );
    }

    // Check if this lowercase slot is claimed by a different user
    if (lockSnap.exists) {
      const lockData = (lockSnap.data() ?? {}) as Record<string, unknown>;
      if (lockData.uid !== uid) {
        throw new HttpsError(
          "already-exists",
          "That name is already taken — please choose another."
        );
      }
      // lockData.uid === uid means the user already owns this name — allow re-claim
    }

    // Release the old lock when an admin is changing the user to a different name
    if (existingLower && existingLower !== rawLower) {
      const oldLockRef = db.collection("usernames").doc(existingLower);
      tx.delete(oldLockRef);
    }

    // Claim the new lock
    tx.set(newLockRef, { uid });

    // Update the user doc
    tx.update(userRef, {
      username: raw,
      usernameLower: rawLower,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  // Patch the leaderboard immediately so the display name appears at once.
  // Intentionally outside the transaction — leaderboard is eventually consistent;
  // a missed patch here is harmless (next recompute will correct it).
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
