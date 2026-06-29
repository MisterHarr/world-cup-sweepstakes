import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireAdmin } from "./auth";
import { patchMatchSummary } from "./matchSummary";
import {
  getErrorMessage,
  markScoresDirty,
  recordRecomputeAttempt,
  recordRecomputeError,
  recordRecomputeSuccess,
} from "./ingestHealth";
import {
  loadKnownTeamIds,
  validateMatchUpdate,
} from "./ingest/validateMatchUpdate";
import type { NormalizedMatchUpdate } from "./providers/providerTypes";

import { CALL_OPTS, HEAVY_CALL_OPTS } from "./runtimeConfig";
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

export const adminUpsertMatch = onCall(CALL_OPTS, async (request) => {
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

  const nowIso = new Date().toISOString();
  const revision =
    typeof existing.providerRevision === "number" &&
    Number.isFinite(existing.providerRevision)
      ? Math.floor(existing.providerRevision) + 1
      : Date.now();

  const normalizedUpdate: NormalizedMatchUpdate = {
    provider: "manual",
    providerMatchId: matchId,
    canonicalMatchId: matchId,
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
    providerUpdatedAt: nowIso,
    ingestReceivedAt: nowIso,
    revision,
    correction: true,
  };

  const knownTeamIds = await loadKnownTeamIds(db);
  const validation = validateMatchUpdate({
    update: normalizedUpdate,
    knownTeamIds,
    existing,
  });

  if (!validation.ok) {
    throw new HttpsError("invalid-argument", validation.message);
  }

  const payload = cleanUndefined({
    matchId: validation.update.canonicalMatchId,
    homeTeamId: validation.update.homeTeamId,
    awayTeamId: validation.update.awayTeamId,
    homeScore: validation.update.homeScore,
    awayScore: validation.update.awayScore,
    status: validation.update.status,
    stage: validation.update.stage,
    kickoffTime: validation.update.kickoffTime,
    homeRedCards: validation.update.homeRedCards,
    homeYellowCards: validation.update.homeYellowCards,
    awayRedCards: validation.update.awayRedCards,
    awayYellowCards: validation.update.awayYellowCards,
    source: "manual",
    provider: validation.update.provider,
    providerMatchId: validation.update.providerMatchId,
    providerUpdatedAt: validation.update.providerUpdatedAt,
    ingestReceivedAt: validation.update.ingestReceivedAt,
    providerRevision: validation.update.revision,
    lastUpdated: FieldValue.serverTimestamp(),
  });

  await ref.set(payload, { merge: true });

  // Keep the client-facing settings/matchSummary aggregate in sync. The
  // dashboard reads matches from that single doc, not the matches collection,
  // so a manual correction (e.g. fixing card counts) must propagate here or
  // the change is invisible to players.
  await patchMatchSummary(db, [{ id: matchId, data: payload }]).catch((err) =>
    console.error("[adminUpsertMatch] patchMatchSummary failed (non-fatal):", err)
  );

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
    stats.goalsScored * 1.5 +
    stats.cleanSheets * 1 +
    stats.redCards * -1 +
    stats.yellowCards * -0.25
  );
}

function hasBadgeUnlockTimestamp(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return isRecord(value);
}

function hasBadgeId(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.badgeId === "string" && value.badgeId.trim().length > 0;
}

function shouldCountBadge(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return value.trim().length > 0;
  if (!isRecord(value)) return false;

  if (value.unlocked === false) return false;
  if (value.unlocked === true) return true;
  if (hasBadgeUnlockTimestamp(value.unlockedAt)) return true;

  return hasBadgeId(value);
}

function readBadgeCount(userData: unknown): number {
  const source = isRecord(userData) ? userData : {};

  if (Array.isArray(source.earnedBadges)) {
    return source.earnedBadges.filter((entry: unknown) => shouldCountBadge(entry))
      .length;
  }

  if (Array.isArray(source.badges)) {
    return source.badges.filter((entry: unknown) => shouldCountBadge(entry)).length;
  }

  if (isRecord(source.badges)) {
    return Object.values(source.badges).filter((value: unknown) => shouldCountBadge(value)).length;
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
  previousRank: number | null;
  department: string | null;
  /** Sum of goals scored by all portfolio teams — used as first tiebreaker. */
  tiebreakGoals: number;
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
  target?: "public" | "shadow";
};

export async function recomputeScoresCore(options: RecomputeOptions) {
  const includeLive = options.includeLive;
  const scoringVersion = options.scoringVersion;
  const initiatedBy = options.initiatedBy;
  const target = options.target ?? "public";
  const isShadowTarget = target === "shadow";
  const matchesCollection = isShadowTarget ? "shadowMatches" : "matches";
  const leaderboardCollection = isShadowTarget
    ? "shadowLeaderboard"
    : "leaderboard";

  await recordRecomputeAttempt();

  try {
    const db = admin.firestore();
    const leaderboardRef = db.collection(leaderboardCollection).doc("current");

    if (isShadowTarget) {
      await leaderboardRef.set(
        {
          lastAttemptAt: FieldValue.serverTimestamp(),
          lastAttemptBy: initiatedBy,
          sourceCollection: matchesCollection,
          target,
        },
        { merge: true }
      );
    }

    const matchesSnap = await db.collection(matchesCollection).get();

    const eligibleStatuses: MatchStatus[] = includeLive
      ? ["LIVE", "FINISHED"]
      : ["FINISHED"];

    // Aggregate per-team stats from a match subset.
    // `minKickoffMs` excludes matches that kicked off at or before that
    // timestamp; `maxKickoffMs` excludes matches that kicked off at or after.
    // Used both for late-joiner filtering (per-user) and for per-team
    // ownership windows when a user has transferred (forward-only scoring).
    // Pass null on either bound for "no limit".
    function aggregateStats(
      minKickoffMs: number | null,
      maxKickoffMs: number | null = null,
      teamFilter: Set<string> | null = null
    ): Record<string, TeamStats> {
      const stats: Record<string, TeamStats> = {};
      matchesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const status = asStatus(data.status);
        if (!status || !eligibleStatuses.includes(status)) return;
        if (data.isScoringEligible === false) return; // placeholder fixtures never count

        // Window filter — applies to late joiners (min) and per-team
        // ownership windows for transferred teams (min and/or max).
        if (minKickoffMs !== null || maxKickoffMs !== null) {
          const kickoffRaw = typeof data.kickoffTime === "string" ? data.kickoffTime : "";
          const kickoffMs = Date.parse(kickoffRaw);
          if (!Number.isNaN(kickoffMs)) {
            if (minKickoffMs !== null && kickoffMs <= minKickoffMs) return;
            if (maxKickoffMs !== null && kickoffMs >= maxKickoffMs) return;
          }
        }

        const homeTeamId = asString(data.homeTeamId);
        const awayTeamId = asString(data.awayTeamId);
        const homeScore = asNumberOrNull(data.homeScore);
        const awayScore = asNumberOrNull(data.awayScore);

        if (!homeTeamId || !awayTeamId) return;
        if (homeScore === null || awayScore === null) return;
        if (teamFilter && !teamFilter.has(homeTeamId) && !teamFilter.has(awayTeamId)) return;

        if (!stats[homeTeamId]) stats[homeTeamId] = emptyStats();
        if (!stats[awayTeamId]) stats[awayTeamId] = emptyStats();

        const home = stats[homeTeamId];
        const away = stats[awayTeamId];

        home.goalsScored += homeScore;
        home.goalsConceded += awayScore;
        away.goalsScored += awayScore;
        away.goalsConceded += homeScore;

        const matchStage = asStage(data.stage) ?? "GROUP";
        const isKnockout = matchStage !== "GROUP";
        const penWinner = asString(data.winner);

        if (homeScore > awayScore || (isKnockout && homeScore === awayScore && penWinner === "HOME")) {
          home.wins += 1;
          away.losses += 1;
        } else if (awayScore > homeScore || (isKnockout && homeScore === awayScore && penWinner === "AWAY")) {
          away.wins += 1;
          home.losses += 1;
        } else if (!isKnockout) {
          home.draws += 1;
          away.draws += 1;
        }

        if (awayScore === 0) home.cleanSheets += 1;
        if (homeScore === 0) away.cleanSheets += 1;

        home.redCards += asNonNegativeNumber(data.homeRedCards) ?? 0;
        home.yellowCards += asNonNegativeNumber(data.homeYellowCards) ?? 0;
        away.redCards += asNonNegativeNumber(data.awayRedCards) ?? 0;
        away.yellowCards += asNonNegativeNumber(data.awayYellowCards) ?? 0;
      });
      return stats;
    }

    // Global stats — used to update teams/{id} docs (full tournament view)
    // and for users who joined before the tournament started.
    const statsByTeam = aggregateStats(null);

    // Earliest match kickoff — used as the fast-path threshold below.
    // If a user joined before this point, no matches are filtered out and we
    // can reuse the global stats without a per-user aggregation pass.
    let earliestKickoffMs = Infinity;
    matchesSnap.docs.forEach((doc) => {
      const kt = doc.data().kickoffTime;
      if (typeof kt === "string") {
        const ms = Date.parse(kt);
        if (!Number.isNaN(ms) && ms < earliestKickoffMs) earliestKickoffMs = ms;
      }
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

    // Derive elimination from actual match RESULTS, not fixture availability.
    // Using "no upcoming fixture" as the signal (the previous approach) wrongly
    // flagged knockout WINNERS as eliminated whenever the next round's bracket
    // hadn't been populated yet by the provider — e.g. Canada beat South
    // Africa in the R32 but had no R16 fixture for a day or two while the
    // bracket was still TBD, so they got marked eliminated right after winning.
    //
    // Correct rule:
    //   • Knockout (non-GROUP) loser in a FINISHED match → eliminated, full
    //     stop, regardless of whether their next-round fixture exists yet.
    //   • Group stage: a team is out once (a) they've played all their group
    //     matches AND (b) the R32 bracket is fully resolved (at least one real,
    //     non-placeholder R32 fixture exists — by construction in ingest.ts's
    //     supersession step, all 16 real R32 fixtures land in the same write,
    //     so "any real R32 fixture exists" means the full lineup is known) AND
    //     (c) the team does not appear in that real R32 lineup.
    const knockoutEliminated = new Set<string>();
    let r32LineupResolved = false;
    const r32TeamIds = new Set<string>();

    matchesSnap.docs.forEach((d) => {
      const m = d.data() as Record<string, unknown>;
      const stage = asStage(m.stage);
      const status = asStatus(m.status);
      const home = asString(m.homeTeamId);
      const away = asString(m.awayTeamId);
      if (!stage || !status || !home || !away) return;

      if (stage === "R32" && m.isPlaceholder !== true) {
        r32LineupResolved = true;
        r32TeamIds.add(home);
        r32TeamIds.add(away);
      }

      if (stage === "GROUP" || status !== "FINISHED") return;

      const homeScore = asNumberOrNull(m.homeScore);
      const awayScore = asNumberOrNull(m.awayScore);
      if (homeScore === null || awayScore === null) return;

      const winnerField = asString(m.winner); // "HOME" | "AWAY" for pens/ET deciders
      let loser: string | null = null;
      if (homeScore > awayScore) loser = away;
      else if (awayScore > homeScore) loser = home;
      else if (winnerField === "HOME") loser = away;
      else if (winnerField === "AWAY") loser = home;

      if (loser) knockoutEliminated.add(loser);
    });

    const teamPlayedGroupCount: Record<string, number> = {};
    matchesSnap.docs.forEach((d) => {
      const m = d.data() as Record<string, unknown>;
      if (asStage(m.stage) !== "GROUP" || asStatus(m.status) !== "FINISHED") return;
      const home = asString(m.homeTeamId);
      const away = asString(m.awayTeamId);
      if (home) teamPlayedGroupCount[home] = (teamPlayedGroupCount[home] ?? 0) + 1;
      if (away) teamPlayedGroupCount[away] = (teamPlayedGroupCount[away] ?? 0) + 1;
    });

    teamsSnap.docs.forEach((teamDoc) => {
      const teamId = teamDoc.id;
      const stats = statsByTeam[teamId] ?? emptyStats();
      const points = calcTeamPoints(stats);
      teamPointsById[teamId] = points;

      const missedGroupAdvancement =
        r32LineupResolved &&
        (teamPlayedGroupCount[teamId] ?? 0) >= 3 &&
        !r32TeamIds.has(teamId);

      const isEliminated = knockoutEliminated.has(teamId) || missedGroupAdvancement;

      teamUpdates.push({
        ref: teamDoc.ref,
        data: {
          ...stats,
          isEliminated,
          lastUpdated: FieldValue.serverTimestamp(),
        },
      });
    });

    if (!isShadowTarget) {
      await commitBatches(teamUpdates);
    }

    const usersSnap = await db.collection("users").get();
    const transferEventsSnap = await db.collection("transferEvents").get();
    const mockUserSettingsSnap = await db.collection("settings").doc("mockUsers").get();
    const mockUserSettings = (mockUserSettingsSnap.exists
      ? mockUserSettingsSnap.data()
      : {}) as Record<string, unknown>;
    const excludeMockUsersFromLeaderboard =
      mockUserSettings.excludeMockUsersFromLeaderboard !== false;
    const transferPenaltyByUserId: Record<string, number> = {};
    type TransferEvent = {
      dropTeamId: string;
      pickupTeamId: string;
      atMs: number;
    };
    const transferEventsByUserId: Record<string, TransferEvent[]> = {};

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

      // Capture per-user transfer history for forward-only scoring windows.
      const dropTeamId = asString(data.dropTeamId);
      const pickupTeamId = asString(data.pickupTeamId);
      const atMs = asNumberOrNull(data.createdAtMs);
      if (dropTeamId && pickupTeamId && atMs !== null) {
        if (!transferEventsByUserId[uid]) transferEventsByUserId[uid] = [];
        transferEventsByUserId[uid].push({ dropTeamId, pickupTeamId, atMs });
      }
    });

    // Sort each user's transfers chronologically so window stitching is correct
    // when a player makes multiple transfers.
    Object.values(transferEventsByUserId).forEach((events) =>
      events.sort((a, b) => a.atMs - b.atMs)
    );

    const userUpdates: BatchUpdate[] = [];

    const rows: LeaderboardRow[] = [];

    usersSnap.docs.forEach((userDoc) => {
      const data = userDoc.data() as Record<string, unknown>;

      const displayName =
        asString(data.username) ??
        asString(data.displayName) ??
        asString(data.name) ??
        "Player";

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

      // Late-joiner rule: a user only scores from matches that kick off
      // AFTER they confirmed their entry.  Read joinedAt from entry.confirmedAt.
      // Users without confirmedAt (legacy/test data) get full scoring.
      let joinedAtMs: number | null = null;
      const confirmedAtRaw = entry?.confirmedAt;
      if (confirmedAtRaw && typeof (confirmedAtRaw as { toMillis?: unknown }).toMillis === "function") {
        joinedAtMs = (confirmedAtRaw as { toMillis: () => number }).toMillis();
      } else if (typeof confirmedAtRaw === "string") {
        const parsed = Date.parse(confirmedAtRaw);
        if (!Number.isNaN(parsed)) joinedAtMs = parsed;
      }

      // Forward-only scoring with per-team ownership windows.
      //
      // For each team currently in the squad we sum stats only from matches
      // kicked off while the team was IN the squad. For users who transferred,
      // teams they dropped also contribute the points they earned BEFORE the
      // drop (so you keep the points your old team built up, and the new team
      // only earns from matches that kick off after you picked them).
      //
      // Window boundaries:
      //   • joinedAt  — entry.confirmedAt (late-joiner floor)
      //   • dropAt    — transferEvent.createdAtMs for the team you dropped
      //   • pickupAt  — transferEvent.createdAtMs for the team you picked up
      //
      // Most users have no transfers and their team-stats reduce to the
      // global aggregation (fast path), so this is cheap.
      const userTransfers = transferEventsByUserId[userDoc.id] ?? [];
      const baseFloorMs =
        joinedAtMs !== null && joinedAtMs >= earliestKickoffMs ? joinedAtMs : null;

      // Build the set of all teams that matter to this user (currently owned
      // PLUS any team they previously dropped), and the (start, end) window
      // for each. A user can transfer multiple times in/out of the same team
      // in principle — we keep a list of windows per team and sum across them.
      type Window = { start: number | null; end: number | null };
      const ownership: Record<string, Window[]> = {};

      const addWindow = (teamId: string, start: number | null, end: number | null) => {
        if (!ownership[teamId]) ownership[teamId] = [];
        ownership[teamId].push({ start, end });
      };

      // Reconstruct the ORIGINAL drawn squad by reverse-applying transfers
      // to the current portfolio. drawnIds reflects the squad AFTER transfers
      // (Germany is in it for EdiHa, Haiti is gone) — so if we seeded windows
      // from drawnIds directly, the pickup team would get double-counted
      // (once as a current squad member, once again from the transfer event).
      const originalDrawnIds = new Set<string>(drawnIds);
      for (const ev of userTransfers) {
        originalDrawnIds.delete(ev.pickupTeamId);
        originalDrawnIds.add(ev.dropTeamId);
      }

      // Featured cannot be transferred, so its window is simply [joinedAt, ∞).
      if (featuredId) addWindow(featuredId, baseFloorMs, null);
      // Initial drawn squad windows ([joinedAt, ∞)).
      originalDrawnIds.forEach((id) => addWindow(id, baseFloorMs, null));

      // Apply each transfer in order: close the drop team's open window at
      // the transfer time, open a new window for the pickup team starting
      // at the transfer time.
      for (const ev of userTransfers) {
        const openWindows = ownership[ev.dropTeamId];
        if (openWindows) {
          // Close the most recent open window for this team.
          for (let i = openWindows.length - 1; i >= 0; i--) {
            if (openWindows[i].end === null) {
              openWindows[i] = { start: openWindows[i].start, end: ev.atMs };
              break;
            }
          }
        }
        addWindow(ev.pickupTeamId, ev.atMs, null);
      }

      // For users with no transfers and no late-joiner offset, this whole
      // section reduces to a lookup in teamPointsById (no extra aggregation).
      const canUseGlobalStats = userTransfers.length === 0 && baseFloorMs === null;

      const pointsForTeam = (teamId: string): { points: number; goals: number } => {
        if (canUseGlobalStats) {
          return {
            points: teamPointsById[teamId] ?? 0,
            goals: statsByTeam[teamId]?.goalsScored ?? 0,
          };
        }
        const windows = ownership[teamId];
        if (!windows || windows.length === 0) return { points: 0, goals: 0 };
        let totalPoints = 0;
        let totalGoals = 0;
        const filter = new Set<string>([teamId]);
        for (const w of windows) {
          const stats = aggregateStats(w.start, w.end, filter)[teamId];
          if (!stats) continue;
          totalPoints += calcTeamPoints(stats);
          totalGoals += stats.goalsScored;
        }
        return { points: totalPoints, goals: totalGoals };
      };

      // Sum: featured ×2, all currently-owned drawn ×1, plus any team
      // previously dropped (its window has end<∞) at ×1.
      const allRelevantTeamIds = Object.keys(ownership);
      let featuredPoints = 0;
      let drawnPoints = 0;
      let tiebreakGoals = 0;
      for (const teamId of allRelevantTeamIds) {
        const { points, goals } = pointsForTeam(teamId);
        if (teamId === featuredId) {
          featuredPoints += points;
        } else {
          drawnPoints += points;
        }
        tiebreakGoals += goals;
      }

      const transferPenaltyPoints = transferPenaltyByUserId[userDoc.id] ?? 0;
      const badgeCount = readBadgeCount(data);

      const totalScore =
        featuredPoints * 2 + drawnPoints - transferPenaltyPoints;

      const isMock = data.isMock === true;

      if (!(excludeMockUsersFromLeaderboard && isMock)) {
        rows.push({
          userId: userDoc.id,
          displayName,
          totalScore,
          tiebreakGoals,
          badgeCount,
          rank: 0,
          previousRank: null,
          department,
        });
      }

      userUpdates.push({
        ref: userDoc.ref,
        data: {
          totalScore,
          transferPenaltyPoints,
          scoreUpdatedAt: FieldValue.serverTimestamp(),
        },
      });
    });

    if (!isShadowTarget) {
      await commitBatches(userUpdates);
    }

    // Capture each user's rank from the previous leaderboard snapshot so the
    // client can show up/down arrows without relying on localStorage.
    const oldLeaderboardSnap = await leaderboardRef.get();
    const oldRankByUserId: Record<string, number> = {};
    if (oldLeaderboardSnap.exists) {
      const oldRows = (oldLeaderboardSnap.data() as Record<string, unknown>).rows;
      if (Array.isArray(oldRows)) {
        for (const r of oldRows) {
          if (r && typeof r === "object" && typeof (r as Record<string, unknown>).userId === "string") {
            const rec = r as Record<string, unknown>;
            const rank = Number(rec.rank);
            if (Number.isFinite(rank)) oldRankByUserId[rec.userId as string] = rank;
          }
        }
      }
    }

    rows.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.tiebreakGoals !== a.tiebreakGoals) return b.tiebreakGoals - a.tiebreakGoals;
      return 0; // genuine tie → same rank, pot is shared
    });

    // Assign ranks with shared positions for genuine ties.
    rows.forEach((row, idx) => {
      if (idx === 0) {
        row.rank = 1;
      } else {
        const prev = rows[idx - 1];
        const sharedWithPrev =
          row.totalScore === prev.totalScore &&
          row.tiebreakGoals === prev.tiebreakGoals;
        row.rank = sharedWithPrev ? prev.rank : idx + 1;
      }
      row.previousRank = oldRankByUserId[row.userId] ?? null;
    });

    await leaderboardRef.set(
      cleanUndefined({
        rows,
        rowCount: rows.length,
        lastUpdated: FieldValue.serverTimestamp(),
        scoringVersion,
        includeLive,
        updatedBy: initiatedBy,
        sourceCollection: matchesCollection,
        target,
        lastAttemptAt: FieldValue.serverTimestamp(),
        lastAttemptBy: initiatedBy,
        lastErrorAt: isShadowTarget ? null : undefined,
        lastErrorMessage: isShadowTarget ? null : undefined,
      }),
      { merge: true }
    );

    await recordRecomputeSuccess({
      clearDirty: !isShadowTarget,
    });

    return {
      ok: true,
      users: rows.length,
      matches: matchesSnap.size,
      transferEvents: transferEventsSnap.size,
      includeLive,
      target,
    };
  } catch (err) {
    const message = getErrorMessage(err);
    if (isShadowTarget) {
      const db = admin.firestore();
      await db.collection(leaderboardCollection).doc("current").set(
        {
          lastAttemptAt: FieldValue.serverTimestamp(),
          lastAttemptBy: initiatedBy,
          lastErrorAt: FieldValue.serverTimestamp(),
          lastErrorMessage: message.slice(0, 1000),
          sourceCollection: matchesCollection,
          target,
        },
        { merge: true }
      );
      await recordRecomputeError(message);
    } else {
      await recordRecomputeError(message);
      await markScoresDirty({ reason: "manual", errorMessage: message });
    }
    throw err;
  }
}

export const recomputeScores = onCall(HEAVY_CALL_OPTS, async (request) => {
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

export const retryDirtyRecompute = onCall(HEAVY_CALL_OPTS, async (request) => {
  requireAdmin(request);

  const payload =
    request.data && typeof request.data === "object"
      ? (request.data as Record<string, unknown>)
      : {};
  const includeLive = payload.includeLive !== false;
  const scoringVersion = asString(payload.scoringVersion) ?? "v1";
  const initiatedBy = request.auth?.uid ?? "unknown";

  const healthSnap = await admin
    .firestore()
    .collection("ingestHealth")
    .doc("current")
    .get();
  const health = (healthSnap.exists ? healthSnap.data() : {}) as Record<string, unknown>;
  const wasDirty = health.scoresDirty === true;
  const dirtyReason = asString(health.dirtyReason);

  const result = await recomputeScoresCore({
    includeLive,
    scoringVersion,
    initiatedBy,
  });

  return {
    wasDirty,
    dirtyReason,
    retried: true,
    ...result,
  };
});

export const recomputeShadowScores = onCall(
  HEAVY_CALL_OPTS,
  async (request) => {
    requireAdmin(request);

    const payload =
      request.data && typeof request.data === "object"
        ? (request.data as Record<string, unknown>)
        : {};
    const includeLive = payload.includeLive !== false;
    const scoringVersion = asString(payload.scoringVersion) ?? "v1";
    const initiatedBy = request.auth?.uid ?? "unknown";

    const result = await recomputeScoresCore({
      includeLive,
      scoringVersion,
      initiatedBy,
      target: "shadow",
    });

    return {
      retried: false,
      ...result,
    };
  }
);
