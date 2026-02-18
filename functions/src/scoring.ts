import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAdmin } from "./auth";

const REGION = "asia-southeast1";
const DEFAULT_TRANSFER_PENALTY_POINTS = 15;

type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";
type MatchStage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "FINAL";
type Department = "Primary" | "Secondary" | "Admin";

type MatchInput = {
  matchId?: unknown;
  homeTeamId?: unknown;
  awayTeamId?: unknown;
  homeScore?: unknown;
  awayScore?: unknown;
  status?: unknown;
  stage?: unknown;
  kickoffTime?: unknown;
  homeRedCards?: unknown;
  homeYellowCards?: unknown;
  awayRedCards?: unknown;
  awayYellowCards?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function asDepartment(value: unknown): Department | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (token === "primary") return "Primary";
  if (token === "secondary") return "Secondary";
  if (
    token === "admin" ||
    token === "opsadmin" ||
    token === "operationsadmin" ||
    token === "ops" ||
    token === "operations"
  ) {
    return "Admin";
  }
  return null;
}

function asNonNegativeNumber(value: unknown): number | null {
  const num = asNumberOrNull(value);
  if (num === null) return null;
  return num < 0 ? null : num;
}

function asStatus(value: unknown): MatchStatus | null {
  return value === "SCHEDULED" || value === "LIVE" || value === "FINISHED"
    ? value
    : null;
}

function asStage(value: unknown): MatchStage | null {
  return value === "GROUP" ||
    value === "R32" ||
    value === "R16" ||
    value === "QF" ||
    value === "SF" ||
    value === "FINAL"
    ? value
    : null;
}

function cleanUndefined<T extends Record<string, unknown>>(obj: T): T {
  const next = { ...obj };
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined) delete next[key];
  });
  return next;
}

export const adminUpsertMatch = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);

  const input = (request.data ?? {}) as MatchInput;

  const matchId = asString(input.matchId);
  if (!matchId) {
    throw new HttpsError("invalid-argument", "matchId is required.");
  }

  const db = admin.firestore();
  const ref = db.collection("matches").doc(matchId);
  const existingSnap = await ref.get();
  const existing = existingSnap.exists
    ? (existingSnap.data() as Record<string, unknown>)
    : {};

  const homeTeamId = asString(input.homeTeamId) ?? asString(existing.homeTeamId);
  const awayTeamId = asString(input.awayTeamId) ?? asString(existing.awayTeamId);

  if (!homeTeamId || !awayTeamId) {
    throw new HttpsError(
      "invalid-argument",
      "homeTeamId and awayTeamId are required."
    );
  }

  const status =
    asStatus(input.status) ??
    asStatus(existing.status) ??
    "SCHEDULED";
  const stage = asStage(input.stage) ?? asStage(existing.stage) ?? "GROUP";

  const kickoffTime =
    asString(input.kickoffTime) ?? asString(existing.kickoffTime) ?? null;

  const homeScore =
    asNumberOrNull(input.homeScore) ?? asNumberOrNull(existing.homeScore);
  const awayScore =
    asNumberOrNull(input.awayScore) ?? asNumberOrNull(existing.awayScore);

  const homeRedCards =
    asNonNegativeNumber(input.homeRedCards) ??
    asNonNegativeNumber(existing.homeRedCards) ??
    0;
  const homeYellowCards =
    asNonNegativeNumber(input.homeYellowCards) ??
    asNonNegativeNumber(existing.homeYellowCards) ??
    0;
  const awayRedCards =
    asNonNegativeNumber(input.awayRedCards) ??
    asNonNegativeNumber(existing.awayRedCards) ??
    0;
  const awayYellowCards =
    asNonNegativeNumber(input.awayYellowCards) ??
    asNonNegativeNumber(existing.awayYellowCards) ??
    0;

  const payload = cleanUndefined({
    matchId,
    homeTeamId,
    awayTeamId,
    homeScore: homeScore ?? null,
    awayScore: awayScore ?? null,
    status,
    stage,
    kickoffTime,
    homeRedCards,
    homeYellowCards,
    awayRedCards,
    awayYellowCards,
    source: "manual",
    lastUpdated: FieldValue.serverTimestamp(),
  });

  await ref.set(payload, { merge: true });

  return { ok: true, matchId };
});

type TeamStats = {
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  redCards: number;
  yellowCards: number;
};

function emptyStats(): TeamStats {
  return {
    wins: 0,
    draws: 0,
    losses: 0,
    goalsScored: 0,
    goalsConceded: 0,
    cleanSheets: 0,
    redCards: 0,
    yellowCards: 0,
  };
}

function calcTeamPoints(stats: TeamStats): number {
  return (
    stats.wins * 3 +
    stats.draws * 1 +
    stats.goalsScored * 1 +
    stats.cleanSheets * 1 +
    stats.redCards * -1 +
    stats.yellowCards * -0.5
  );
}

function hasBadgeEntry(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (!isRecord(value)) return false;
  return typeof value.badgeId === "string" && value.badgeId.trim().length > 0;
}

function readBadgeCount(userData: unknown): number {
  const source = isRecord(userData) ? userData : {};

  if (Array.isArray(source.earnedBadges)) {
    return source.earnedBadges.filter((entry: unknown) => hasBadgeEntry(entry))
      .length;
  }

  if (Array.isArray(source.badges)) {
    return source.badges.filter((entry: unknown) => hasBadgeEntry(entry)).length;
  }

  if (isRecord(source.badges)) {
    return Object.values(source.badges).filter((value: unknown) => {
      if (value === true) return true;
      if (!isRecord(value)) return false;
      if (value.unlocked === true) return true;
      return isRecord(value.unlockedAt);
    }).length;
  }

  return 0;
}

type BatchUpdate = {
  ref: FirebaseFirestore.DocumentReference;
  data: Record<string, unknown>;
};

type LeaderboardRow = {
  userId: string;
  displayName: string;
  totalScore: number;
  badgeCount: number;
  rank: number;
  department: string | null;
};

type PortfolioItem = {
  teamId: string;
  role: "featured" | "drawn";
};

function readPortfolio(value: unknown): PortfolioItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry: unknown): PortfolioItem | null => {
      if (!isRecord(entry)) return null;
      const teamId = asString(entry.teamId);
      const role =
        entry.role === "featured" || entry.role === "drawn" ? entry.role : null;
      if (!teamId || !role) return null;
      return { teamId, role };
    })
    .filter((entry): entry is PortfolioItem => entry !== null);
}

type RecomputeOptions = {
  includeLive: boolean;
  scoringVersion: string;
  initiatedBy: string;
};

export async function recomputeScoresCore(options: RecomputeOptions) {
  const includeLive = options.includeLive;
  const scoringVersion = options.scoringVersion;
  const initiatedBy = options.initiatedBy;

  const db = admin.firestore();
  const matchesSnap = await db.collection("matches").get();

  const statsByTeam: Record<string, TeamStats> = {};
  const eligibleStatuses: MatchStatus[] = includeLive
    ? ["LIVE", "FINISHED"]
    : ["FINISHED"];

  matchesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const status = asStatus(data.status);
    if (!status || !eligibleStatuses.includes(status)) return;

    const homeTeamId = asString(data.homeTeamId);
    const awayTeamId = asString(data.awayTeamId);
    const homeScore = asNumberOrNull(data.homeScore);
    const awayScore = asNumberOrNull(data.awayScore);

    if (!homeTeamId || !awayTeamId) return;
    if (homeScore === null || awayScore === null) return;

    if (!statsByTeam[homeTeamId]) statsByTeam[homeTeamId] = emptyStats();
    if (!statsByTeam[awayTeamId]) statsByTeam[awayTeamId] = emptyStats();

    const home = statsByTeam[homeTeamId];
    const away = statsByTeam[awayTeamId];

    home.goalsScored += homeScore;
    home.goalsConceded += awayScore;
    away.goalsScored += awayScore;
    away.goalsConceded += homeScore;

    if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (homeScore < awayScore) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
    }

    if (awayScore === 0) home.cleanSheets += 1;
    if (homeScore === 0) away.cleanSheets += 1;

    const homeRedCards = asNonNegativeNumber(data.homeRedCards) ?? 0;
    const homeYellowCards = asNonNegativeNumber(data.homeYellowCards) ?? 0;
    const awayRedCards = asNonNegativeNumber(data.awayRedCards) ?? 0;
    const awayYellowCards = asNonNegativeNumber(data.awayYellowCards) ?? 0;

    home.redCards += homeRedCards;
    home.yellowCards += homeYellowCards;
    away.redCards += awayRedCards;
    away.yellowCards += awayYellowCards;
  });

  const teamsSnap = await db.collection("teams").get();
  const teamPointsById: Record<string, number> = {};

  const commitBatches = async (updates: BatchUpdate[]) => {
    const maxBatch = 450;
    let batch = db.batch();
    let writes = 0;

    for (const update of updates) {
      batch.set(update.ref, update.data, { merge: true });
      writes += 1;
      if (writes >= maxBatch) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }

    if (writes > 0) {
      await batch.commit();
    }
  };

  const teamUpdates: BatchUpdate[] = [];

  teamsSnap.docs.forEach((teamDoc) => {
    const teamId = teamDoc.id;
    const stats = statsByTeam[teamId] ?? emptyStats();
    const points = calcTeamPoints(stats);
    teamPointsById[teamId] = points;

    teamUpdates.push({
      ref: teamDoc.ref,
      data: {
        ...stats,
        lastUpdated: FieldValue.serverTimestamp(),
      },
    });
  });

  await commitBatches(teamUpdates);

  const usersSnap = await db.collection("users").get();
  const transferEventsSnap = await db.collection("transferEvents").get();
  const transferPenaltyByUserId: Record<string, number> = {};

  transferEventsSnap.docs.forEach((transferEventDoc) => {
    const data = transferEventDoc.data() as Record<string, unknown>;
    const uid = asString(data.uid);
    if (!uid) return;

    const scoringPenaltyPoints =
      asNumberOrNull(data.scoringPenaltyPoints) ??
      DEFAULT_TRANSFER_PENALTY_POINTS;
    const penaltyPoints = Number.isFinite(scoringPenaltyPoints)
      ? scoringPenaltyPoints
      : DEFAULT_TRANSFER_PENALTY_POINTS;

    transferPenaltyByUserId[uid] =
      (transferPenaltyByUserId[uid] ?? 0) + penaltyPoints;
  });

  const userUpdates: BatchUpdate[] = [];

  const rows: LeaderboardRow[] = [];

  usersSnap.docs.forEach((userDoc) => {
    const data = userDoc.data() as Record<string, unknown>;

    const displayName =
      asString(data.displayName) ??
      asString(data.name) ??
      asString(data.email) ??
      "Anonymous";

    const department = asDepartment(data.department);

    let featuredId: string | null = null;
    let drawnIds: string[] = [];

    const portfolio = readPortfolio(data.portfolio);
    portfolio.forEach((item) => {
      if (item.role === "featured") featuredId = item.teamId;
      if (item.role === "drawn") drawnIds.push(item.teamId);
    });

    const entry = isRecord(data.entry) ? data.entry : null;
    if (!featuredId && entry && entry.featuredTeamId) {
      featuredId = asString(entry.featuredTeamId);
    }
    if (drawnIds.length === 0 && entry && Array.isArray(entry.drawnTeamIds)) {
      drawnIds = entry.drawnTeamIds
        .map((id: unknown) => asString(id))
        .filter((id): id is string => Boolean(id));
    }

    const featuredPoints = featuredId ? teamPointsById[featuredId] ?? 0 : 0;
    const drawnPoints = drawnIds.reduce(
      (sum, teamId) => sum + (teamPointsById[teamId] ?? 0),
      0
    );
    const transferPenaltyPoints = transferPenaltyByUserId[userDoc.id] ?? 0;
    const badgeCount = readBadgeCount(data);

    const totalScore = featuredPoints * 2 + drawnPoints - transferPenaltyPoints;

    rows.push({
      userId: userDoc.id,
      displayName,
      totalScore,
      badgeCount,
      rank: 0,
      department,
    });

    userUpdates.push({
      ref: userDoc.ref,
      data: {
        totalScore,
        transferPenaltyPoints,
        scoreUpdatedAt: FieldValue.serverTimestamp(),
      },
    });
  });

  await commitBatches(userUpdates);

  rows.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.displayName.localeCompare(b.displayName);
  });

  rows.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  await db
    .collection("leaderboard")
    .doc("current")
    .set(
      {
        rows,
        lastUpdated: FieldValue.serverTimestamp(),
        scoringVersion,
        includeLive,
        updatedBy: initiatedBy,
      },
      { merge: true }
    );

  return {
    ok: true,
    users: rows.length,
    matches: matchesSnap.size,
    transferEvents: transferEventsSnap.size,
    includeLive,
  };
}

export const recomputeScores = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);

  const payload =
    request.data && typeof request.data === "object"
      ? (request.data as Record<string, unknown>)
      : {};
  const includeLive = payload.includeLive !== false;
  const scoringVersion = asString(payload.scoringVersion) ?? "v1";
  const initiatedBy = request.auth?.uid ?? "unknown";

  return recomputeScoresCore({ includeLive, scoringVersion, initiatedBy });
});
