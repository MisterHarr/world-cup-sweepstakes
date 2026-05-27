import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule, type ScheduledEvent } from "firebase-functions/v2/scheduler";
import fixtures from "./fixtures/worldcup2022.json";
import preTournamentFixtures from "./fixtures/pretournament2022.json";
import {
  getErrorMessage,
  markScoresDirty,
  recordIngestAttempt,
  recordIngestError,
  recordIngestSuccess,
} from "./ingestHealth";
import { recomputeScoresCore } from "./scoring";
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

import { CALL_OPTS, HEAVY_CALL_OPTS, REGION } from "./runtimeConfig";
const SCHEDULE = "every 10 minutes";

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

  validMatches.forEach((match) => {
    const existing = existingById[match.canonicalMatchId];
    if (!isDifferent(existing, match)) return;

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

  if (shouldRecompute) {
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

  return {
    updated: updates.length,
    matches: normalizedUpdates.length,
    quarantined: rejected.length,
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

    await recordIngestAttempt({
      activeProvider: liveOps.provider,
      mode: liveOps.mode,
    });

    try {
      const target = getLiveOpsTarget(liveOps.mode);
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
