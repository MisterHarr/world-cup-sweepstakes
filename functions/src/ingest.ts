import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule, type ScheduledEvent } from "firebase-functions/v2/scheduler";
import fixtures from "./fixtures/worldcup2022.json";
import preTournamentFixtures from "./fixtures/pretournament2022.json";
import { KNOCKOUT_PLACEHOLDERS_2026 } from "./fixtures/knockoutPlaceholders2026";
import {
  getErrorMessage,
  markScoresDirty,
  recordIngestAttempt,
  recordIngestError,
  recordIngestSuccess,
} from "./ingestHealth";
import { recomputeScoresCore } from "./scoring";
import { patchMatchSummary } from "./matchSummary";
import { requireAdmin } from "./auth";
import { getFootballDataMatches } from "./providers/footballDataProvider";
import {
  FOOTBALL_DATA_TOKEN,
  filterAndLimitMatches,
  isRecord,
  asString,
} from "./providers/providerUtils";
import {
  loadKnownTeamIds,
  validateMatchUpdate,
  type ValidatedMatchUpdate,
} from "./ingest/validateMatchUpdate";
import type {
  MatchStage,
  MatchStatus,
  NormalizedMatchProvider,
  NormalizedMatchUpdate,
  ProviderMatch,
} from "./providers/providerTypes";

import {
  computePollingGate,
  isScoringRelevantChange,
  POLLING_MAX_ELAPSED_MS,
  POLLING_PRE_KICKOFF_MS,
  type ScheduleEntry,
} from "./pollingWindow";
import { CALL_OPTS, HEAVY_CALL_OPTS, REGION } from "./runtimeConfig";
// Fire every 2 minutes so live matches appear (and scores/cards update) within
// ~2 min of kickoff instead of lagging up to a full 10-minute cycle. The
// polling gate (computePollingGate) makes off-window ticks near-free — it does
// a single time-bounded query that matches 0 docs when no match is in its
// [kickoff − 10 min, kickoff + duration] window — so the extra ticks only do
// real fetch/write work while a match is actually in progress.
const SCHEDULE = "every 2 minutes";

/**
 * Tournament kickoff (Mexico v South Africa, 11 Jun 2026, 19:00 UTC).
 *
 * The fixture-replay providers below read static 2022 World Cup data
 * (worldcup2022.json / pretournament2022.json) — a pre-tournament rehearsal
 * tool. Once the real tournament is underway, live scores come exclusively
 * from the football-data provider via the scheduled poll, and any fixture
 * ingest would inject fake/historical results into production (this happened
 * on 2026-06-11). From kickoff onward the fixture sources return nothing and
 * the admin fixture-ingest callables refuse to run, so 2022 data can never
 * re-enter production no matter how the path is triggered (UI, direct call,
 * or a mis-set liveOps provider).
 */
const TOURNAMENT_START_MS = Date.parse("2026-06-11T19:00:00.000Z");
function tournamentHasStarted(): boolean {
  return Date.now() >= TOURNAMENT_START_MS;
}

export type LiveScoresProvider =
  | "stub"
  | "fixture"
  | "football-data";
type LiveOpsRunStatus = "success" | "error";
export type LiveOpsMode = "disabled" | "shadow" | "staging" | "production";

const LIVE_OPS_HISTORY_LIMIT = 12;

export type ApplyMatchUpdatesResult = {
  updated: number;
  matches: number;
  quarantined: number;
  /** Number of placeholder docs deleted because real fixtures for the same stage were written. */
  deletedPlaceholders?: number;
};

type LiveOpsConfig = {
  enabled: boolean;
  mode: LiveOpsMode;
  provider: LiveScoresProvider;
  fixtureMaxMatches: number;
  fixtureCutoffIso: string | null;
};

const DEFAULT_LIVE_OPS: LiveOpsConfig = {
  enabled: false,
  mode: "disabled",
  provider: "fixture",
  fixtureMaxMatches: 0,
  fixtureCutoffIso: null,
};

function asNumberOrNull(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function asNonNegativeNumber(value: unknown): number {
  const num = asNumberOrNull(value);
  if (num === null) return 0;
  return num < 0 ? 0 : num;
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

function asProvider(value: unknown): LiveScoresProvider | null {
  if (
    value === "stub" ||
    value === "fixture" ||
    value === "football-data"
  ) {
    return value;
  }
  if (value === "provider") {
    return "football-data";
  }
  return null;
}

function asMode(value: unknown): LiveOpsMode | null {
  return value === "disabled" ||
    value === "shadow" ||
    value === "staging" ||
    value === "production"
    ? value
    : null;
}

function asNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const n = Math.floor(value);
  return n < 0 ? 0 : n;
}

function asIsoOrNull(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}

function normalizeLiveOpsConfig(raw: unknown): LiveOpsConfig {
  const config = isRecord(raw) ? raw : {};
  const mode =
    asMode(config.mode) ??
    (config.enabled === true ? "production" : DEFAULT_LIVE_OPS.mode);
  return {
    enabled: mode !== "disabled",
    mode,
    provider: asProvider(config.provider) ?? DEFAULT_LIVE_OPS.provider,
    fixtureMaxMatches: asNonNegativeInteger(config.fixtureMaxMatches),
    fixtureCutoffIso: asIsoOrNull(config.fixtureCutoffIso),
  };
}

function getLiveOpsTarget(mode: LiveOpsMode): {
  collectionName: "matches" | "shadowMatches";
  recompute: boolean;
  recomputeTarget: "public" | "shadow";
} {
  if (mode === "shadow" || mode === "staging") {
    return {
      collectionName: "shadowMatches",
      recompute: false,
      recomputeTarget: "shadow",
    };
  }

  return {
    collectionName: "matches",
    recompute: true,
    recomputeTarget: "public",
  };
}

function getManualIngestTargetOrThrow(mode: LiveOpsMode): {
  collectionName: "matches" | "shadowMatches";
  recompute: boolean;
  recomputeTarget: "public" | "shadow";
  label: string;
} {
  if (mode === "disabled") {
    throw new HttpsError(
      "failed-precondition",
      "Live ops mode is disabled. Switch to shadow, staging, or production before running manual ingest."
    );
  }

  const target = getLiveOpsTarget(mode);
  return {
    ...target,
    label: target.collectionName,
  };
}

function toProviderMatch(raw: unknown): ProviderMatch | null {
  const source = isRecord(raw) ? raw : {};
  const matchId = asString(source.matchId);
  const homeTeamId = asString(source.homeTeamId);
  const awayTeamId = asString(source.awayTeamId);
  const status = asStatus(source.status);
  const stage = asStage(source.stage);
  const kickoffTime = asString(source.kickoffTime) ?? null;

  if (!matchId || !homeTeamId || !awayTeamId || !status || !stage) {
    return null;
  }

  return {
    matchId,
    homeTeamId,
    awayTeamId,
    homeScore: asNumberOrNull(source.homeScore),
    awayScore: asNumberOrNull(source.awayScore),
    status,
    stage,
    kickoffTime,
    homeRedCards: asNonNegativeNumber(source.homeRedCards),
    homeYellowCards: asNonNegativeNumber(source.homeYellowCards),
    awayRedCards: asNonNegativeNumber(source.awayRedCards),
    awayYellowCards: asNonNegativeNumber(source.awayYellowCards),
  };
}

type FetchProviderOptions = {
  provider?: LiveScoresProvider;
  maxMatches?: number;
  cutoffIso?: string | null;
};

async function fetchProviderMatches(
  options: FetchProviderOptions = {}
): Promise<ProviderMatch[]> {
  const provider =
    options.provider ??
    asProvider(process.env.LIVE_SCORES_PROVIDER) ??
    "stub";
  const maxMatches = asNonNegativeInteger(
    options.maxMatches ?? Number(process.env.FIXTURE_MAX_MATCHES ?? 0)
  );
  const cutoffIso =
    asIsoOrNull(options.cutoffIso ?? null) ??
    asIsoOrNull(process.env.FIXTURE_CUTOFF);

  if (provider === "stub") {
    console.log(
      "[ingest] LIVE_SCORES_PROVIDER not set. Skipping ingestion."
    );
    const rawMatches: unknown[] = [];
    return rawMatches
      .map((item) => toProviderMatch(item))
      .filter((item): item is ProviderMatch => Boolean(item));
  }

  if (provider === "fixture") {
    return getFixtureMatches({ maxMatches, cutoffIso });
  }

  if (provider === "football-data") {
    try {
      return await getFootballDataMatches({ maxMatches, cutoffIso });
    } catch (err) {
      console.error("[ingest] football-data fetch failed:", err);
      return [];
    }
  }

  console.error(`[ingest] Unsupported provider: ${String(provider)}`);
  return [];
}

async function getLiveOpsConfig(): Promise<LiveOpsConfig> {
  const db = admin.firestore();
  const snap = await db.collection("settings").doc("liveOps").get();

  if (!snap.exists) {
    return DEFAULT_LIVE_OPS;
  }

  return normalizeLiveOpsConfig(snap.data());
}

type FixtureOptions = {
  maxMatches?: number;
  cutoffIso?: string | null;
};

export async function writeLiveOpsHealth(data: {
  mode?: LiveOpsMode;
  provider: LiveScoresProvider;
  matches?: number;
  updated?: number;
  errorMessage?: string | null;
}): Promise<void> {
  const db = admin.firestore();
  const ref = db.collection("settings").doc("liveOps");
  const now = FieldValue.serverTimestamp();
  const hasError = Boolean(data.errorMessage);
  const status: LiveOpsRunStatus = hasError ? "error" : "success";
  const matches = asNonNegativeInteger(data.matches ?? 0);
  const updated = asNonNegativeInteger(data.updated ?? 0);
  const runAtIso = new Date().toISOString();
  const safeErrorMessage =
    hasError && typeof data.errorMessage === "string"
      ? data.errorMessage.slice(0, 1000)
      : null;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.exists ? snap.data() : {}) as Record<string, unknown>;
      const currentRunsRaw = Array.isArray(current.recentRuns)
        ? current.recentRuns
        : [];

      const currentRuns = currentRunsRaw
        .map((run: unknown) => {
          if (!isRecord(run)) return null;
          const at = asIsoOrNull(run.at);
          const runStatus =
            run.status === "success" || run.status === "error"
              ? run.status
              : null;
          const runProvider = asProvider(run.provider);

          if (!at || !runStatus || !runProvider) return null;

          return {
            at,
            status: runStatus,
            provider: runProvider,
            matches: asNonNegativeInteger(run.matches),
            updated: asNonNegativeInteger(run.updated),
            errorMessage:
              typeof run.errorMessage === "string"
                ? run.errorMessage.slice(0, 1000)
                : null,
          };
        })
        .filter((run): run is {
        at: string;
        status: LiveOpsRunStatus;
        provider: LiveScoresProvider;
        matches: number;
        updated: number;
        errorMessage: string | null;
      } => run !== null);

      const nextRun = {
        at: runAtIso,
        status,
        provider: data.provider,
        matches,
        updated,
        errorMessage: safeErrorMessage,
      };

      const currentFailures = asNonNegativeInteger(current.consecutiveFailures);
      const consecutiveFailures = hasError ? currentFailures + 1 : 0;

      const payload: Record<string, unknown> = {
        lastRunAt: now,
        lastRunAtIso: runAtIso,
        lastRunProvider: data.provider,
        ...(data.mode ? { mode: data.mode } : {}),
        lastRunMatches: matches,
        lastRunUpdated: updated,
        lastRunStatus: status,
        consecutiveFailures,
        recentRuns: [nextRun, ...currentRuns].slice(0, LIVE_OPS_HISTORY_LIMIT),
      };

      if (hasError) {
        payload.lastErrorAt = now;
        payload.lastErrorMessage = safeErrorMessage;
      } else {
        payload.lastSuccessAt = now;
        payload.lastErrorMessage = null;
      }

      tx.set(ref, payload, { merge: true });
    });
  } catch (err) {
    console.error("[ingest] failed to write liveOps health:", err);
  }
}

function getFixtureMatches(options: FixtureOptions = {}): ProviderMatch[] {
  if (tournamentHasStarted()) {
    console.warn(
      "[ingest] Fixture replay (2022 data) is disabled — the tournament has started. Returning no matches."
    );
    return [];
  }

  const maxMatches = asNonNegativeInteger(options.maxMatches ?? 0);
  const cutoffIso = asIsoOrNull(options.cutoffIso);

  const raw = Array.isArray(fixtures) ? fixtures : [];
  const normalized = raw
    .map((item) => toProviderMatch(item))
    .filter((item): item is ProviderMatch => Boolean(item));
  const limited = filterAndLimitMatches(normalized, { maxMatches, cutoffIso });

  console.log(
    `[ingest] fixture provider loaded ${limited.length} matches` +
      (cutoffIso ? ` (cutoff ${cutoffIso})` : "") +
      (maxMatches > 0 ? ` (max ${maxMatches})` : "")
  );

  return limited;
}

function getPreTournamentFixtures(options: FixtureOptions = {}): ProviderMatch[] {
  if (tournamentHasStarted()) {
    console.warn(
      "[ingest] Pre-tournament fixture replay (2022 data) is disabled — the tournament has started. Returning no matches."
    );
    return [];
  }

  const maxMatches = asNonNegativeInteger(options.maxMatches ?? 0);
  const cutoffIso = asIsoOrNull(options.cutoffIso);

  const raw = Array.isArray(preTournamentFixtures) ? preTournamentFixtures : [];
  const normalized = raw
    .map((item) => toProviderMatch(item))
    .filter((item): item is ProviderMatch => Boolean(item));

  const limited = filterAndLimitMatches(normalized, { maxMatches, cutoffIso });

  console.log(
    `[ingest] pre-tournament fixture loaded ${limited.length} matches` +
      (cutoffIso ? ` (cutoff ${cutoffIso})` : "") +
      (maxMatches > 0 ? ` (max ${maxMatches})` : "")
  );

  return limited;
}

function summarizeNormalizedUpdate(update: NormalizedMatchUpdate) {
  return {
    provider: update.provider,
    providerMatchId: update.providerMatchId,
    canonicalMatchId: update.canonicalMatchId,
    homeTeamId: update.homeTeamId,
    awayTeamId: update.awayTeamId,
    kickoffTime: update.kickoffTime,
    status: update.status,
    stage: update.stage,
    homeScore: update.homeScore,
    awayScore: update.awayScore,
    homeYellowCards: update.homeYellowCards ?? 0,
    awayYellowCards: update.awayYellowCards ?? 0,
    homeRedCards: update.homeRedCards ?? 0,
    awayRedCards: update.awayRedCards ?? 0,
    providerUpdatedAt: update.providerUpdatedAt,
    ingestReceivedAt: update.ingestReceivedAt,
    revision: update.revision,
  };
}

function toNormalizedProvider(source: IngestOptions["source"]): NormalizedMatchProvider {
  if (source === "fixture") return "fixture-replay";
  return "football-data";
}

function toNormalizedMatchUpdate(
  match: ProviderMatch,
  provider: NormalizedMatchProvider
): NormalizedMatchUpdate {
  const nowIso = new Date().toISOString();
  return {
    provider,
    providerMatchId: match.matchId,
    canonicalMatchId: match.matchId,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    kickoffTime: match.kickoffTime,
    status: match.status,
    stage: match.stage,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeYellowCards: match.homeYellowCards,
    awayYellowCards: match.awayYellowCards,
    homeRedCards: match.homeRedCards,
    awayRedCards: match.awayRedCards,
    minute: match.minute ?? null,
    homeScoreHT: match.homeScoreHT ?? null,
    awayScoreHT: match.awayScoreHT ?? null,
    homeScorePens: match.homeScorePens ?? null,
    awayScorePens: match.awayScorePens ?? null,
    winner: match.winner ?? null,
    goals: match.goals ?? [],
    providerUpdatedAt: nowIso,
    ingestReceivedAt: nowIso,
    revision: Date.now(),
  };
}

async function writeProviderRawSummaries(
  db: FirebaseFirestore.Firestore,
  updates: NormalizedMatchUpdate[]
): Promise<void> {
  if (!updates.length) return;

  const maxBatch = 450;
  let batch = db.batch();
  let writes = 0;

  for (const update of updates) {
    const ref = db
      .collection("providerRaw")
      .doc(update.provider)
      .collection("updates")
      .doc();

    batch.set(ref, {
      ...summarizeNormalizedUpdate(update),
      createdAt: FieldValue.serverTimestamp(),
    });
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
}

async function quarantineRejectedUpdates(
  db: FirebaseFirestore.Firestore,
  rejected: Array<{
    update: NormalizedMatchUpdate;
    reason: string;
    message: string;
  }>
): Promise<void> {
  if (!rejected.length) return;

  const maxBatch = 450;
  let batch = db.batch();
  let writes = 0;

  for (const item of rejected) {
    const ref = db.collection("providerErrors").doc();
    batch.set(ref, {
      provider: item.update.provider,
      providerMatchId: item.update.providerMatchId,
      canonicalMatchId: item.update.canonicalMatchId,
      reason: item.reason,
      message: item.message,
      payloadSummary: summarizeNormalizedUpdate(item.update),
      createdAt: FieldValue.serverTimestamp(),
      handled: false,
    });
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
}

function isDifferent(
  existing: FirebaseFirestore.DocumentData | undefined,
  incoming: ValidatedMatchUpdate
): boolean {
  if (!existing) return true;

  const fields: Array<
    | "homeTeamId"
    | "awayTeamId"
    | "homeScore"
    | "awayScore"
    | "status"
    | "stage"
    | "kickoffTime"
    | "homeRedCards"
    | "homeYellowCards"
    | "awayRedCards"
    | "awayYellowCards"
    | "minute"
    | "homeScoreHT"
    | "awayScoreHT"
    | "homeScorePens"
    | "awayScorePens"
    | "winner"
    | "providerRevision"
  > = [
    "homeTeamId",
    "awayTeamId",
    "homeScore",
    "awayScore",
    "status",
    "stage",
    "kickoffTime",
    "homeRedCards",
    "homeYellowCards",
    "awayRedCards",
    "awayYellowCards",
    "minute",
    "homeScoreHT",
    "awayScoreHT",
    "homeScorePens",
    "awayScorePens",
    "winner",
    "providerRevision",
  ];

  return fields.some((field) => {
    const current = existing[field];
    const next =
      field === "providerRevision" ? incoming.revision : incoming[field];
    return current !== next;
  });
}

export type IngestOptions = {
  source: "football-data" | "fixture";
  initiatedBy: string;
  collectionName?: "matches" | "shadowMatches";
  recompute?: boolean;
  recomputeTarget?: "public" | "shadow";
};

export async function applyNormalizedMatchUpdates(
  normalizedUpdates: NormalizedMatchUpdate[],
  options: IngestOptions
): Promise<ApplyMatchUpdatesResult> {
  if (!normalizedUpdates.length) {
    return { updated: 0, matches: 0, quarantined: 0 };
  }

  const db = admin.firestore();
  const collectionName = options.collectionName ?? "matches";
  const shouldRecompute = options.recompute !== false;
  await writeProviderRawSummaries(db, normalizedUpdates);

  const refs = normalizedUpdates.map((update) =>
    db.collection(collectionName).doc(update.canonicalMatchId)
  );
  const [snaps, knownTeamIds] = await Promise.all([
    db.getAll(...refs),
    loadKnownTeamIds(db),
  ]);

  const existingById: Record<string, FirebaseFirestore.DocumentData | undefined> =
    {};

  snaps.forEach((snap) => {
    existingById[snap.id] = snap.exists ? snap.data() : undefined;
  });

  const rejected: Array<{
    update: NormalizedMatchUpdate;
    reason: string;
    message: string;
  }> = [];
  const validMatches: ValidatedMatchUpdate[] = [];

  normalizedUpdates.forEach((update) => {
    const result = validateMatchUpdate({
      update,
      knownTeamIds,
      existing: existingById[update.canonicalMatchId] as Record<string, unknown> | undefined,
    });

    if (!result.ok) {
      rejected.push({
        update,
        reason: result.reason,
        message: result.message,
      });
      return;
    }

    validMatches.push(result.update);
  });

  await quarantineRejectedUpdates(db, rejected);

  const updates: Array<{
    ref: FirebaseFirestore.DocumentReference;
    data: Record<string, unknown>;
  }> = [];
  let hasScoringRelevantChange = false;

  validMatches.forEach((match) => {
    const existing = existingById[match.canonicalMatchId];
    if (!isDifferent(existing, match)) return;
    if (isScoringRelevantChange(existing, match)) hasScoringRelevantChange = true;

    updates.push({
      ref: db.collection(collectionName).doc(match.canonicalMatchId),
      data: {
        matchId: match.canonicalMatchId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        status: match.status,
        stage: match.stage,
        kickoffTime: match.kickoffTime,
        homeRedCards: match.homeRedCards,
        homeYellowCards: match.homeYellowCards,
        awayRedCards: match.awayRedCards,
        awayYellowCards: match.awayYellowCards,
        minute: match.minute ?? null,
        homeScoreHT: match.homeScoreHT ?? null,
        awayScoreHT: match.awayScoreHT ?? null,
        homeScorePens: match.homeScorePens ?? null,
        awayScorePens: match.awayScorePens ?? null,
        winner: match.winner ?? null,
        goals: match.goals ?? [],
        source: options.source,
        provider: match.provider,
        providerMatchId: match.providerMatchId,
        providerUpdatedAt: match.providerUpdatedAt,
        ingestReceivedAt: match.ingestReceivedAt,
        providerRevision: match.revision,
        lastUpdated: FieldValue.serverTimestamp(),
      },
    });
  });

  if (!updates.length) {
    return {
      updated: 0,
      matches: normalizedUpdates.length,
      quarantined: rejected.length,
    };
  }

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

  if (shouldRecompute && hasScoringRelevantChange) {
    const recomputeTarget = options.recomputeTarget ?? "public";
    try {
      await recomputeScoresCore({
        includeLive: true,
        scoringVersion: "v1",
        initiatedBy: options.initiatedBy,
        target: recomputeTarget,
      });
    } catch (err) {
      if (recomputeTarget === "public") {
        await markScoresDirty({
          reason: "ingest",
          errorMessage: getErrorMessage(err),
        });
      }
      throw err;
    }
  }

  // Supersession: when real knockout fixtures from football-data.org are written
  // to the production `matches` collection, automatically delete any placeholder
  // docs for the same stage.  This prevents the UI from showing both a placeholder
  // ("Runner-up Group A") and the real fixture side-by-side.
  //
  // Stage-level cleanup is safe: by the time the first R32 match kicks off, ALL
  // 32 R32 team slots are resolved, so all 16 R32 real fixtures are written in
  // the same ingest cycle.  Same logic applies to R16, QF, SF, FINAL.
  //
  // Only runs for the live provider writing to the public collection — not for
  // fixture replay or shadow mode.
  let deletedPlaceholders = 0;
  if (options.source === "football-data" && collectionName === "matches") {
    const knockoutStagesWritten = new Set(
      updates
        .map((u) => u.data.stage as string)
        .filter((stage) => stage !== "GROUP")
    );

    if (knockoutStagesWritten.size > 0) {
      const placeholderSnap = await db
        .collection(collectionName)
        .where("isPlaceholder", "==", true)
        .get();

      const toDelete = placeholderSnap.docs.filter((d) =>
        knockoutStagesWritten.has(d.get("stage") as string)
      );

      if (toDelete.length > 0) {
        let delBatch = db.batch();
        let delCount = 0;
        for (const doc of toDelete) {
          delBatch.delete(doc.ref);
          delCount += 1;
          if (delCount >= 400) {
            await delBatch.commit();
            delBatch = db.batch();
            delCount = 0;
          }
        }
        if (delCount > 0) await delBatch.commit();
        deletedPlaceholders = toDelete.length;
        console.log(
          `[ingest] Deleted ${deletedPlaceholders} placeholder doc(s) superseded by ` +
          `real knockout fixtures (stages: ${[...knockoutStagesWritten].join(", ")})`
        );
      }
    }
  }

  // Rebuild the match summary document after writing to the public matches
  // collection.  This single-doc summary (settings/matchSummary) is what the
  // frontend reads instead of issuing 104 separate document reads.
  // Cost: 1 read (existing summary) + 1 write per ingest cycle.
  if (collectionName === "matches" && updates.length > 0) {
    patchMatchSummary(db, updates.map((u) => ({ id: u.ref.id, data: u.data }))).catch(
      (err) => console.error("[ingest] patchMatchSummary failed (non-fatal):", err)
    );
  }

  return {
    updated: updates.length,
    matches: normalizedUpdates.length,
    quarantined: rejected.length,
    ...(deletedPlaceholders > 0 ? { deletedPlaceholders } : {}),
  };
}

async function applyMatchUpdates(
  matches: ProviderMatch[],
  options: IngestOptions
): Promise<ApplyMatchUpdatesResult> {
  const normalizedUpdates = matches.map((match) =>
    toNormalizedMatchUpdate(match, toNormalizedProvider(options.source))
  );

  return applyNormalizedMatchUpdates(normalizedUpdates, options);
}

async function countFixtureMatches(
  collectionName: "matches" | "shadowMatches" = "matches"
): Promise<number> {
  const db = admin.firestore();
  const snap = await db
    .collection(collectionName)
    .where("source", "==", "fixture")
    .get();
  return snap.size;
}

async function deleteFixtureMatches(
  collectionName: "matches" | "shadowMatches" = "matches"
): Promise<number> {
  const db = admin.firestore();
  let deleted = 0;

  while (true) {
    const snap = await db
      .collection(collectionName)
      .where("source", "==", "fixture")
      .limit(400)
      .get();

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

export const ingestLiveScores = onSchedule(
  {
    ...HEAVY_CALL_OPTS,
    schedule: SCHEDULE,
    timeZone: "UTC",
    secrets: [FOOTBALL_DATA_TOKEN],
  },
  async (_event: ScheduledEvent) => {
    const liveOps = await getLiveOpsConfig();
    if (liveOps.mode === "disabled") {
      console.log("[ingest] liveOps disabled. Skipping scheduled ingest.");
      return;
    }

    // Polling gate — time-bounded Firestore query.
    //
    // Previous approach read ALL docs in the collection to pass to
    // computePollingGate, costing 104 reads on every 10-minute tick even when
    // the gate immediately returned "skip".  104 reads × 144 ticks/day = 14 976
    // reads/day from the gate alone, before any user traffic.
    //
    // New approach: query only the docs whose kickoffTime falls inside the
    // possible polling window [now − 8 h, now + 10 min].  Outside the
    // tournament (or between match days) this range matches 0 docs and Firestore
    // charges 0 reads.  On a live match day it returns 1–4 docs.
    const db = admin.firestore();
    const target = getLiveOpsTarget(liveOps.mode);
    const nowMs = Date.now();
    const maxPastIso = new Date(nowMs - POLLING_MAX_ELAPSED_MS).toISOString();
    const preKickoffIso = new Date(nowMs + POLLING_PRE_KICKOFF_MS).toISOString();

    const windowSnap = await db
      .collection(target.collectionName)
      .where("kickoffTime", ">=", maxPastIso)
      .where("kickoffTime", "<=", preKickoffIso)
      .select("kickoffTime", "stage", "status")
      .get();

    if (windowSnap.empty) {
      // No match doc falls in the active window → guaranteed skip, 0 reads charged.
      console.log("[ingest] No match in polling window. Skipping.");
      return;
    }

    const firestoreSchedule: ScheduleEntry[] = windowSnap.docs.map((d) => ({
      kickoffTime: d.get("kickoffTime"),
      stage: d.get("stage"),
    }));

    const gate = computePollingGate(nowMs, firestoreSchedule);

    if (gate === "skip") {
      console.log("[ingest] No match in polling window. Skipping.");
      return;
    }

    if (gate === "check-live") {
      // Matches are in the time range but past their fixed window — check for LIVE.
      const hasLiveInWindow = windowSnap.docs.some((d) => d.get("status") === "LIVE");
      if (!hasLiveInWindow) {
        // Also check outside the window: a very long match could have pushed past
        // POLLING_MAX_ELAPSED_MS (extremely rare — 8 h after kickoff).
        const liveSnap = await db
          .collection(target.collectionName)
          .where("status", "==", "LIVE")
          .limit(1)
          .get();
        if (liveSnap.empty) {
          console.log("[ingest] No active matches. Skipping.");
          return;
        }
      }
      console.log("[ingest] Live match detected outside time window — continuing.");
    }

    await recordIngestAttempt({
      activeProvider: liveOps.provider,
      mode: liveOps.mode,
    });

    try {
      const matches = await fetchProviderMatches({
        provider: liveOps.provider,
        maxMatches: liveOps.fixtureMaxMatches,
        cutoffIso: liveOps.fixtureCutoffIso,
      });
      const source =
        liveOps.provider === "fixture"
          ? "fixture"
          : "football-data";
      const result = matches.length
        ? await applyMatchUpdates(matches, {
            source,
            initiatedBy: "scheduler",
            collectionName: target.collectionName,
            recompute: true,
            recomputeTarget: target.recomputeTarget,
          })
        : { updated: 0, matches: 0, quarantined: 0 };

      await writeLiveOpsHealth({
        mode: liveOps.mode,
        provider: liveOps.provider,
        matches: result.matches,
        updated: result.updated,
        errorMessage: null,
      });
      await recordIngestSuccess({
        activeProvider: liveOps.provider,
        mode: liveOps.mode,
      });
    } catch (err) {
      console.error("[ingest] scheduled ingest failed:", err);
      const message = getErrorMessage(err);
      await writeLiveOpsHealth({
        mode: liveOps.mode,
        provider: liveOps.provider,
        errorMessage: message,
      });
      await recordIngestError({
        activeProvider: liveOps.provider,
        errorMessage: message,
        mode: liveOps.mode,
      });
    }
  }
);

export const adminIngestFixture = onCall(
  CALL_OPTS,
  async (request) => {
    requireAdmin(request);

    if (tournamentHasStarted()) {
      throw new HttpsError(
        "failed-precondition",
        "Fixture ingest is locked: the tournament has started. Live scores come from the automatic feed — loading the 2022 rehearsal data now would corrupt the standings."
      );
    }

    const maxMatches = Number(request.data?.maxMatches ?? 0);
    const cutoffIso = asString(request.data?.cutoffIso) ?? null;
    const dryRun = request.data?.dryRun === true;

    const matches = getFixtureMatches({ maxMatches, cutoffIso });
    const liveOps = await getLiveOpsConfig();

    if (dryRun) {
      const target =
        liveOps.mode === "disabled" ? "disabled" : getLiveOpsTarget(liveOps.mode).collectionName;
      return {
        ok: true,
        matches: matches.length,
        updated: 0,
        dryRun: true,
        mode: liveOps.mode,
        target,
      };
    }

    const target = getManualIngestTargetOrThrow(liveOps.mode);

    await recordIngestAttempt({
      activeProvider: "fixture",
      mode: liveOps.mode,
    });

    try {
      const result = await applyMatchUpdates(matches, {
        source: "fixture",
        initiatedBy: request.auth?.uid ?? "admin",
        collectionName: target.collectionName,
        recompute: true,
        recomputeTarget: target.recomputeTarget,
      });

      await recordIngestSuccess({
        activeProvider: "fixture",
        mode: liveOps.mode,
      });

      return {
        ok: true,
        mode: liveOps.mode,
        target: target.label,
        ...result,
      };
    } catch (err) {
      await recordIngestError({
        activeProvider: "fixture",
        errorMessage: getErrorMessage(err),
        mode: liveOps.mode,
      });
      throw err;
    }
  }
);

export const adminResetFixtureIngest = onCall(
  CALL_OPTS,
  async (request) => {
    requireAdmin(request);

    if (tournamentHasStarted()) {
      throw new HttpsError(
        "failed-precondition",
        "Fixture reset is locked: the tournament has started. Clearing and reloading from the 2022 rehearsal data now would wipe the live standings."
      );
    }

    const maxMatches = Number(request.data?.maxMatches ?? 0);
    const cutoffIso = asString(request.data?.cutoffIso) ?? null;
    const dryRun = request.data?.dryRun === true;

    const matches = getFixtureMatches({ maxMatches, cutoffIso });
    const liveOps = await getLiveOpsConfig();
    const target =
      liveOps.mode === "disabled" ? null : getLiveOpsTarget(liveOps.mode);
    const existingFixtureMatches = await countFixtureMatches(
      target?.collectionName ?? "matches"
    );

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        existingFixtureMatches,
        willDelete: existingFixtureMatches,
        willIngest: matches.length,
        mode: liveOps.mode,
        target: target?.collectionName ?? "disabled",
      };
    }

    const manualTarget = getManualIngestTargetOrThrow(liveOps.mode);

    await recordIngestAttempt({
      activeProvider: "fixture",
      mode: liveOps.mode,
    });

    try {
      const deletedFixtureMatches = await deleteFixtureMatches(
        manualTarget.collectionName
      );
      const result = await applyMatchUpdates(matches, {
        source: "fixture",
        initiatedBy: request.auth?.uid ?? "admin",
        collectionName: manualTarget.collectionName,
        recompute: true,
        recomputeTarget: manualTarget.recomputeTarget,
      });

      if (!matches.length || result.updated === 0) {
        await recomputeScoresCore({
          includeLive: true,
          scoringVersion: "v1",
          initiatedBy: request.auth?.uid ?? "admin",
          target: manualTarget.recomputeTarget,
        });
      }

      await recordIngestSuccess({
        activeProvider: "fixture",
        mode: liveOps.mode,
      });

      return {
        ok: true,
        mode: liveOps.mode,
        target: manualTarget.label,
        deletedFixtureMatches,
        ...result,
      };
    } catch (err) {
      await recordIngestError({
        activeProvider: "fixture",
        errorMessage: getErrorMessage(err),
        mode: liveOps.mode,
      });
      throw err;
    }
  }
);

export const adminIngestPreTournament = onCall(
  CALL_OPTS,
  async (request) => {
    requireAdmin(request);

    if (tournamentHasStarted()) {
      throw new HttpsError(
        "failed-precondition",
        "Pre-tournament import is locked: the tournament has started. Importing the 2022 history now would inject fake results into the live standings."
      );
    }

    const maxMatches = Number(request.data?.maxMatches ?? 0);
    const cutoffIso = asString(request.data?.cutoffIso) ?? null;
    const dryRun = request.data?.dryRun === true;

    const matches = getPreTournamentFixtures({ maxMatches, cutoffIso });
    const liveOps = await getLiveOpsConfig();

    if (dryRun) {
      const target =
        liveOps.mode === "disabled" ? "disabled" : getLiveOpsTarget(liveOps.mode).collectionName;
      return {
        ok: true,
        matches: matches.length,
        updated: 0,
        dryRun: true,
        mode: liveOps.mode,
        target,
      };
    }

    const target = getManualIngestTargetOrThrow(liveOps.mode);

    await recordIngestAttempt({
      activeProvider: "fixture",
      mode: liveOps.mode,
    });

    try {
      const result = await applyMatchUpdates(matches, {
        source: "fixture",
        initiatedBy: request.auth?.uid ?? "admin",
        collectionName: target.collectionName,
        recompute: true,
        recomputeTarget: target.recomputeTarget,
      });

      await recordIngestSuccess({
        activeProvider: "fixture",
        mode: liveOps.mode,
      });

      return {
        ok: true,
        mode: liveOps.mode,
        target: target.label,
        ...result,
      };
    } catch (err) {
      await recordIngestError({
        activeProvider: "fixture",
        errorMessage: getErrorMessage(err),
        mode: liveOps.mode,
      });
      throw err;
    }
  }
);

export const adminContractTestProvider = onCall(
  { region: REGION, secrets: [FOOTBALL_DATA_TOKEN] },
  async (request) => {
    requireAdmin(request);

    const provider = asProvider(request.data?.provider);
    if (!provider || provider === "stub" || provider === "fixture") {
      throw new HttpsError(
        "invalid-argument",
        "provider must be: football-data."
      );
    }

    const maxMatches = Number(request.data?.maxMatches ?? 0);
    const cutoffIso = asString(request.data?.cutoffIso) ?? null;
    const dryRun = request.data?.dryRun === true;

    await recordIngestAttempt({
      activeProvider: provider,
      mode: "shadow",
    });

    try {
      const matches = await fetchProviderMatches({
        provider,
        maxMatches,
        cutoffIso,
      });

      if (dryRun) {
        await writeLiveOpsHealth({
          mode: "shadow",
          provider,
          matches: matches.length,
          updated: 0,
          errorMessage: null,
        });
        await recordIngestSuccess({
          activeProvider: provider,
          mode: "shadow",
        });
        return {
          ok: true,
          provider,
          dryRun: true,
          matches: matches.length,
          target: "shadowMatches",
        };
      }

      const result = await applyMatchUpdates(matches, {
        source: provider,
        initiatedBy: request.auth?.uid ?? "admin",
        collectionName: "shadowMatches",
        recompute: true,
        recomputeTarget: "shadow",
      });

      await writeLiveOpsHealth({
        mode: "shadow",
        provider,
        matches: result.matches,
        updated: result.updated,
        errorMessage: null,
      });
      await recordIngestSuccess({
        activeProvider: provider,
        mode: "shadow",
      });

      return {
        ok: true,
        provider,
        target: "shadowMatches",
        leaderboardTarget: "shadowLeaderboard/current",
        ...result,
      };
    } catch (err) {
      const message = getErrorMessage(err);
      await writeLiveOpsHealth({
        mode: "shadow",
        provider,
        errorMessage: message,
      });
      await recordIngestError({
        activeProvider: provider,
        errorMessage: message,
        mode: "shadow",
      });
      throw err;
    }
  }
);

/**
 * Seed knockout-stage placeholder fixtures into the production `matches`
 * collection.  Placeholder docs have:
 *   • TBD-* team IDs (absent from `teams` → quarantined by validateMatchUpdate)
 *   • isScoringEligible: false (skipped by recomputeScoresCore)
 *   • isPlaceholder: true
 *
 * The polling gate uses their kickoffTime to open the window on schedule,
 * so the scheduler calls football-data.org automatically once knockout
 * fixtures are published with real team IDs.
 *
 * Pass dryRun:true to preview without writing.
 * Pass force:true to overwrite existing placeholder docs.
 */
export const adminSeedKnockoutPlaceholders = onCall(
  CALL_OPTS,
  async (request) => {
    requireAdmin(request);

    const payload = (request.data ?? {}) as Record<string, unknown>;
    const dryRun = payload.dryRun === true;
    const force = payload.force === true;

    const db = admin.firestore();
    const collectionName = "matches";

    // Check which placeholder docs already exist
    const existingIds = new Set<string>();
    if (!force) {
      const existingSnap = await db
        .collection(collectionName)
        .where("isPlaceholder", "==", true)
        .get();
      existingSnap.docs.forEach((d) => existingIds.add(d.id));
    }

    const toWrite = KNOCKOUT_PLACEHOLDERS_2026.filter(
      (p) => force || !existingIds.has(p.matchId)
    );

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        total: KNOCKOUT_PLACEHOLDERS_2026.length,
        alreadyExist: existingIds.size,
        wouldWrite: toWrite.length,
        fixtures: toWrite.map((p) => ({
          matchId: p.matchId,
          stage: p.stage,
          kickoffTime: p.kickoffTime,
          home: p.homePlaceholder,
          away: p.awayPlaceholder,
        })),
      };
    }

    const now = FieldValue.serverTimestamp();
    const maxBatch = 450;
    let batch = db.batch();
    let writes = 0;

    for (const p of toWrite) {
      const ref = db.collection(collectionName).doc(p.matchId);
      batch.set(ref, {
        matchId: p.matchId,
        homeTeamId: p.homeTeamId,
        awayTeamId: p.awayTeamId,
        homePlaceholder: p.homePlaceholder,
        awayPlaceholder: p.awayPlaceholder,
        kickoffTime: p.kickoffTime,
        stage: p.stage,
        status: "SCHEDULED",
        homeScore: null,
        awayScore: null,
        homeRedCards: 0,
        homeYellowCards: 0,
        awayRedCards: 0,
        awayYellowCards: 0,
        isPlaceholder: true,
        isScoringEligible: false,
        source: "placeholder",
        lastUpdated: now,
      });
      writes += 1;
      if (writes >= maxBatch) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }
    if (writes > 0) await batch.commit();

    return {
      ok: true,
      dryRun: false,
      total: KNOCKOUT_PLACEHOLDERS_2026.length,
      skipped: existingIds.size,
      written: toWrite.length,
    };
  }
);

/**
 * One-shot production bootstrap: fetch real knockout fixtures from
 * football-data.org and write them to the `matches` collection.
 *
 * Use this after the group stage ends, once football-data.org has real
 * team IDs for the R32.  Run adminContractTestProvider (shadow) first to
 * confirm the data looks correct, then call this to go live.
 */
export const adminBootstrapKnockoutFixtures = onCall(
  { ...HEAVY_CALL_OPTS, secrets: [FOOTBALL_DATA_TOKEN] },
  async (request) => {
    requireAdmin(request);

    const liveOps = await getLiveOpsConfig();
    if (liveOps.provider !== "football-data") {
      throw new HttpsError(
        "failed-precondition",
        "liveOps.provider must be football-data to bootstrap knockout fixtures."
      );
    }

    const dryRun = (request.data as Record<string, unknown>)?.dryRun === true;

    await recordIngestAttempt({
      activeProvider: liveOps.provider,
      mode: liveOps.mode,
    });

    try {
      const matches = await fetchProviderMatches({
        provider: liveOps.provider,
        maxMatches: 0,
        cutoffIso: null,
      });

      if (dryRun) {
        await recordIngestSuccess({ activeProvider: liveOps.provider, mode: liveOps.mode });
        return {
          ok: true,
          dryRun: true,
          matchesFromProvider: matches.length,
          knockoutMatches: matches.filter((m) => m.stage !== "GROUP").length,
        };
      }

      const target = getLiveOpsTarget(liveOps.mode);
      const result = matches.length
        ? await applyMatchUpdates(matches, {
            source: "football-data",
            initiatedBy: request.auth?.uid ?? "admin",
            collectionName: target.collectionName,
            recompute: true,
            recomputeTarget: target.recomputeTarget,
          })
        : { updated: 0, matches: 0, quarantined: 0 };

      await recordIngestSuccess({ activeProvider: liveOps.provider, mode: liveOps.mode });

      return {
        ok: true,
        dryRun: false,
        matchesFromProvider: matches.length,
        ...result,
      };
    } catch (err) {
      const message = getErrorMessage(err);
      await recordIngestError({ activeProvider: liveOps.provider, errorMessage: message, mode: liveOps.mode });
      throw err;
    }
  }
);

export const setLiveOpsSettings = onCall(
  { region: REGION, secrets: [FOOTBALL_DATA_TOKEN] },
  async (request) => {
    const auth = requireAdmin(request);
    const payload = request.data ?? {};

    const mode =
      asMode(payload.mode) ??
      (payload.enabled === true ? "production" : "disabled");
    const providerInput = payload.provider;
    const provider = asProvider(providerInput);
    if (!provider) {
      throw new HttpsError(
        "invalid-argument",
        "provider must be one of: stub, fixture, football-data."
      );
    }

    const fixtureMaxMatches = asNonNegativeInteger(payload.fixtureMaxMatches);
    const cutoffRaw = asString(payload.fixtureCutoffIso);
    const fixtureCutoffIso = cutoffRaw ? asIsoOrNull(cutoffRaw) : null;
    if (cutoffRaw && !fixtureCutoffIso) {
      throw new HttpsError(
        "invalid-argument",
        "fixtureCutoffIso must be a valid ISO timestamp."
      );
    }

    const enabled = mode !== "disabled";

    if (mode !== "disabled" && provider === "football-data") {
      if (
        !(
          asString(FOOTBALL_DATA_TOKEN.value()) ??
          asString(process.env.FOOTBALL_DATA_TOKEN)
        )
      ) {
        throw new HttpsError(
          "failed-precondition",
          "FOOTBALL_DATA_TOKEN is required before enabling football-data automation."
        );
      }
    }

    const db = admin.firestore();
    await db.collection("settings").doc("liveOps").set(
      {
        enabled,
        mode,
        provider,
        fixtureMaxMatches,
        fixtureCutoffIso,
        updatedBy: auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      ok: true,
      enabled,
      mode,
      provider,
      fixtureMaxMatches,
      fixtureCutoffIso,
    };
  }
);
