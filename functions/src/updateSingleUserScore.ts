/**
 * Lightweight function to update a single user's score and add them to the leaderboard.
 * Used after squad confirmation to avoid recomputing all users during signup rush.
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  asString,
  asNumberOrNull,
  asNonNegativeNumber,
  asStatus,
  calcTeamPoints,
  emptyStats,
  DEFAULT_TRANSFER_PENALTY_POINTS,
} from "./scoring";
import type { TeamStats, MatchStatus } from "./scoring";

interface UpdateSingleUserScoreOptions {
  uid: string;
  includeLive: boolean;
  scoringVersion: string;
}

/**
 * Calculate a single user's score and add/update their entry in the leaderboard.
 * Much faster than recomputeScoresCore during high-concurrency signups.
 */
export async function updateSingleUserScore(
  options: UpdateSingleUserScoreOptions
): Promise<{ totalScore: number; rank: number }> {
  const { uid, includeLive, scoringVersion } = options;
  const db = admin.firestore();

  // 1. Calculate team points from matches (shared calculation)
  const teamPointsById = await calculateTeamPoints(db, includeLive);

  // 2. Get user's portfolio and calculate their score
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error(`User ${uid} not found`);
  }

  const userData = userSnap.data() as any;

  const displayName =
    asString(userData?.displayName) ??
    asString(userData?.name) ??
    asString(userData?.email) ??
    "Anonymous";

  const department =
    userData?.department === "Primary" ||
    userData?.department === "Secondary" ||
    userData?.department === "Admin"
      ? userData.department
      : null;

  // Extract featured and drawn teams (supports both portfolio and entry schemas)
  let featuredId: string | null = null;
  let drawnIds: string[] = [];

  if (Array.isArray(userData?.portfolio)) {
    userData.portfolio.forEach((item: any) => {
      const teamId = asString(item?.teamId);
      if (!teamId) return;
      if (item?.role === "featured") featuredId = teamId;
      if (item?.role === "drawn") drawnIds.push(teamId);
    });
  }

  if (!featuredId && userData?.entry?.featuredTeamId) {
    featuredId = asString(userData.entry.featuredTeamId);
  }
  if (drawnIds.length === 0 && Array.isArray(userData?.entry?.drawnTeamIds)) {
    drawnIds = userData.entry.drawnTeamIds
      .map((id: unknown) => asString(id))
      .filter(Boolean) as string[];
  }

  // Calculate transfer penalties
  const transferEventsSnap = await db
    .collection("transferEvents")
    .where("uid", "==", uid)
    .get();

  let transferPenaltyPoints = 0;
  transferEventsSnap.docs.forEach((doc) => {
    const data = doc.data() as any;
    const penaltyPoints =
      asNumberOrNull(data?.scoringPenaltyPoints) ??
      DEFAULT_TRANSFER_PENALTY_POINTS;
    transferPenaltyPoints += Number.isFinite(penaltyPoints)
      ? penaltyPoints
      : DEFAULT_TRANSFER_PENALTY_POINTS;
  });

  // Calculate user's total score
  const featuredPoints = featuredId ? teamPointsById[featuredId] ?? 0 : 0;
  const drawnPoints = drawnIds.reduce(
    (sum, teamId) => sum + (teamPointsById[teamId] ?? 0),
    0
  );
  const totalScore = featuredPoints * 2 + drawnPoints - transferPenaltyPoints;

  // 3. Update user's totalScore in their document
  await userRef.set(
    {
      totalScore,
      transferPenaltyPoints,
      scoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 4. Add/update user in leaderboard incrementally
  const leaderboardRef = db.collection("leaderboard").doc("current");
  const leaderboardSnap = await leaderboardRef.get();

  let rows: Array<{
    userId: string;
    displayName: string;
    totalScore: number;
    rank: number;
    department: string | null;
  }> = [];

  if (leaderboardSnap.exists) {
    const data = leaderboardSnap.data() as any;
    rows = Array.isArray(data?.rows) ? data.rows : [];
  }

  // Remove existing entry for this user (if any)
  rows = rows.filter((row) => row.userId !== uid);

  // Add new entry
  rows.push({
    userId: uid,
    displayName,
    totalScore,
    rank: 0, // Will be recalculated after sorting
    department,
  });

  // Re-sort and re-rank
  rows.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.displayName.localeCompare(b.displayName);
  });

  rows.forEach((row, idx) => {
    row.rank = idx + 1;
  });

  // Update leaderboard document
  await leaderboardRef.set(
    {
      rows,
      lastUpdated: FieldValue.serverTimestamp(),
      scoringVersion,
      includeLive,
      updatedBy: uid,
    },
    { merge: true }
  );

  // Find and return the user's rank
  const userRow = rows.find((row) => row.userId === uid);
  const rank = userRow?.rank ?? rows.length;

  return { totalScore, rank };
}

/**
 * Calculate points for all teams based on match results.
 * Shared utility used by both full recompute and single-user update.
 */
async function calculateTeamPoints(
  db: FirebaseFirestore.Firestore,
  includeLive: boolean
): Promise<Record<string, number>> {
  const matchesSnap = await db.collection("matches").get();

  const statsByTeam: Record<string, TeamStats> = {};
  const eligibleStatuses: MatchStatus[] = includeLive
    ? ["LIVE", "FINISHED"]
    : ["FINISHED"];

  matchesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const status = asStatus(data?.status);
    if (!status || !eligibleStatuses.includes(status)) return;

    const homeTeamId = asString(data?.homeTeamId);
    const awayTeamId = asString(data?.awayTeamId);
    const homeScore = asNumberOrNull(data?.homeScore);
    const awayScore = asNumberOrNull(data?.awayScore);

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

    const homeRedCards = asNonNegativeNumber(data?.homeRedCards) ?? 0;
    const homeYellowCards = asNonNegativeNumber(data?.homeYellowCards) ?? 0;
    const awayRedCards = asNonNegativeNumber(data?.awayRedCards) ?? 0;
    const awayYellowCards = asNonNegativeNumber(data?.awayYellowCards) ?? 0;

    home.redCards += homeRedCards;
    home.yellowCards += homeYellowCards;
    away.redCards += awayRedCards;
    away.yellowCards += awayYellowCards;
  });

  const teamPointsById: Record<string, number> = {};

  // Calculate points for each team
  Object.keys(statsByTeam).forEach((teamId) => {
    const stats = statsByTeam[teamId];
    teamPointsById[teamId] = calcTeamPoints(stats);
  });

  return teamPointsById;
}
