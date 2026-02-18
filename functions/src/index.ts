import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

// ✅ Set your preferred region here
const REGION = "asia-southeast1";

/* ======================================================
   Utilities
====================================================== */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNonNegativeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

type PortfolioItem = { teamId: string; role: "featured" | "drawn" };

type TeamSeedRow = {
  id: string;
  name: string;
  group: string;
  tier: number;
  flagUrl: string;
};

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

  return {
    id,
    name,
    group,
    tier,
    flagUrl,
  };
}

function hasErrorCode(value: unknown): value is { code: unknown } {
  return isRecord(value) && "code" in value;
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
    remainingTransfers: asNonNegativeNumber(existing.remainingTransfers) ?? 2,
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

export const ensureUserProfile = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

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

/* ======================================================
   FEATURED TEAM + DRAW LOGIC (unchanged)
====================================================== */

export const assignDrawnTeams = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
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
    return { ok: true, message: "Drawn teams already assigned." };
  }

  const teamsSnap = await db.collection("teams").get();
  const allTeamIds = teamsSnap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return asTrimmedString(data.id) ?? d.id;
    })
    .filter((x): x is string => typeof x === "string" && x.length > 0);

  const exclude = new Set<string>([
    featured.teamId,
    ...existingDrawn.map((p) => p.teamId),
  ]);

  const candidates = allTeamIds.filter((id) => !exclude.has(id));

  if (candidates.length < 5) {
    throw new HttpsError(
      "internal",
      `Not enough teams to draw 5. Candidates=${candidates.length} TotalTeams=${allTeamIds.length}`
    );
  }

  const picked = shuffle(candidates).slice(0, 5);

  const nextPortfolio = [
    { teamId: featured.teamId, role: "featured" as const },
    ...picked.map((teamId) => ({ teamId, role: "drawn" as const })),
  ];

  await userRef.update({
    portfolio: nextPortfolio,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, picked };
});

export const confirmFeaturedTeam = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const requestData = isRecord(request.data) ? request.data : {};
  const teamId = requestData.teamId;
  if (typeof teamId !== "string" || teamId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "teamId must be provided.");
  }

  const userRef = db.collection("users").doc(uid);

  const teamsSnap = await db.collection("teams").get();
  const allTeams = teamsSnap.docs
    .map((d): TeamSeedRow | null => {
      const data = d.data() as Record<string, unknown>;
      return readTeamSeedRow(data, d.id);
    })
    .filter((team): team is TeamSeedRow => team !== null);

  const featuredTeam = allTeams.find((t) => t.id === teamId);
  if (!featuredTeam) {
    throw new HttpsError("not-found", "Selected team does not exist.");
  }

  const eligibleForDraw = allTeams.filter((t) => t.id !== teamId);
  if (eligibleForDraw.length < 5) {
    throw new HttpsError("failed-precondition", "Not enough teams to draw from.");
  }

  // Tier-balanced draw: 1 from tier-1, 1 from tier-2, 2 from tier-3, 1 from tier-4
  const tier1 = eligibleForDraw.filter((t) => t.tier === 1);
  const tier2 = eligibleForDraw.filter((t) => t.tier === 2);
  const tier3 = eligibleForDraw.filter((t) => t.tier === 3);
  const tier4 = eligibleForDraw.filter((t) => t.tier === 4);

  const drawnTeams = [
    ...shuffle(tier1).slice(0, 1),
    ...shuffle(tier2).slice(0, 1),
    ...shuffle(tier3).slice(0, 2),
    ...shuffle(tier4).slice(0, 1),
  ];

  // Fallback if not enough teams in specific tiers
  if (drawnTeams.length < 5) {
    const remaining = 5 - drawnTeams.length;
    const drawnIds = new Set(drawnTeams.map((t) => t.id));
    const available = eligibleForDraw.filter((t) => !drawnIds.has(t.id));
    drawnTeams.push(...shuffle(available).slice(0, remaining));
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

/* ======================================================
   DEPARTMENT SET (NEW – SAFE + CENTRAL)
====================================================== */

const ALLOWED_DEPARTMENTS = ["Primary", "Secondary", "Admin"] as const;
type Department = (typeof ALLOWED_DEPARTMENTS)[number];

export const setDepartment = onCall({ region: REGION }, async (request) => {
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

/* ======================================================
   ADMIN / BOOTSTRAP EXPORTS (unchanged)
====================================================== */

/* ======================================================
   ADMIN: ASSIGN TEAMS TO USERS WITHOUT THEM
====================================================== */

export const adminListUsers = onCall({ region: REGION }, async (request) => {
  const isAdmin = request.auth?.token?.admin === true;
  if (!isAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

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

export const adminAssignTeamsToUser = onCall({ region: REGION }, async (request) => {
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

  // Get all teams
  const teamsSnap = await db.collection("teams").get();
  type TeamPoolRow = {
    id: string;
    name: string;
    tier: number;
  };
  const allTeams = teamsSnap.docs
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
      return {
        id,
        name,
        tier,
      };
    })
    .filter((team): team is TeamPoolRow => team !== null);

  if (allTeams.length < 6) {
    throw new HttpsError("failed-precondition", "Not enough teams in database.");
  }

  // Pick a random featured team
  const shuffledTeams = shuffle(allTeams);
  const featuredTeam = shuffledTeams[0];
  const eligibleForDraw = shuffledTeams.slice(1);

  // Tier-balanced draw: 1 from tier-1, 1 from tier-2, 2 from tier-3, 1 from tier-4
  const tier1 = eligibleForDraw.filter((t) => t.tier === 1);
  const tier2 = eligibleForDraw.filter((t) => t.tier === 2);
  const tier3 = eligibleForDraw.filter((t) => t.tier === 3);
  const tier4 = eligibleForDraw.filter((t) => t.tier === 4);

  const drawnTeams = [
    ...shuffle(tier1).slice(0, 1),
    ...shuffle(tier2).slice(0, 1),
    ...shuffle(tier3).slice(0, 2),
    ...shuffle(tier4).slice(0, 1),
  ];

  // Fallback if not enough teams in specific tiers
  if (drawnTeams.length < 5) {
    const remaining = 5 - drawnTeams.length;
    const drawnIds = new Set(drawnTeams.map((t) => t.id));
    const available = eligibleForDraw.filter((t) => !drawnIds.has(t.id));
    drawnTeams.push(...shuffle(available).slice(0, remaining));
  }

  // Create portfolio and entry
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

export { setAdminClaim } from "./admin";
export { getLeaderboard } from "./getLeaderboard";
export { getSquadDetails } from "./getSquadDetails";
export { getTransferHistory } from "./getTransferHistory";
export { executeTransfer } from "./transfers";
export { adminUpsertMatch, recomputeScores } from "./scoring";
export {
  ingestLiveScores,
  adminIngestFixture,
  adminResetFixtureIngest,
  adminIngestPreTournament,
  setLiveOpsSettings,
} from "./ingest";
