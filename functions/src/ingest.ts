import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule, type ScheduledEvent } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import fixtures from "./fixtures/worldcup2022.json";
import { recomputeScoresCore } from "./scoring";
import { requireAdmin } from "./auth";

const REGION = "asia-southeast1";
const SCHEDULE = "every 10 minutes";
const FOOTBALL_DATA_BASE_DEFAULT = "https://api.football-data.org/v4";
const FOOTBALL_DATA_COMPETITION_DEFAULT = "WC";
const PROVIDER_TIMEOUT_MS_DEFAULT = 12_000;
const PROVIDER_MAX_RETRIES_DEFAULT = 1;
const TEAM_LOOKUP_TTL_MS = 5 * 60 * 1000;
const FOOTBALL_DATA_TOKEN = defineSecret("FOOTBALL_DATA_TOKEN");

type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";
type MatchStage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "FINAL";
type LiveScoresProvider = "stub" | "fixture" | "provider";
type LiveOpsRunStatus = "success" | "error";

const LIVE_OPS_HISTORY_LIMIT = 12;

type ProviderMatch = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  stage: MatchStage;
  kickoffTime: string | null;
  homeRedCards: number;
  homeYellowCards: number;
  awayRedCards: number;
  awayYellowCards: number;
};

type LiveOpsConfig = {
  enabled: boolean;
  provider: LiveScoresProvider;
  fixtureMaxMatches: number;
  fixtureCutoffIso: string | null;
};

const DEFAULT_LIVE_OPS: LiveOpsConfig = {
  enabled: false,
  provider: "fixture",
  fixtureMaxMatches: 0,
  fixtureCutoffIso: null,
};

let teamLookupCache:
  | { expiresAt: number; lookup: Record<string, string> }
  | null = null;

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
  return value === "stub" || value === "fixture" || value === "provider"
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

function toUpperToken(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const token = raw.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  return token.length ? token : null;
}

function normalizeNameToken(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const token = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return token.length ? token : null;
}

function toProviderStatus(value: unknown): MatchStatus | null {
  const status = asString(value)?.toUpperCase();
  if (!status) return null;

  if (status === "IN_PLAY" || status === "PAUSED" || status === "LIVE") {
    return "LIVE";
  }
  if (
    status === "FINISHED" ||
    status === "AWARDED" ||
    status === "AFTER_EXTRA_TIME" ||
    status === "PENALTY_SHOOTOUT"
  ) {
    return "FINISHED";
  }
  if (
    status === "SCHEDULED" ||
    status === "TIMED" ||
    status === "POSTPONED" ||
    status === "SUSPENDED"
  ) {
    return "SCHEDULED";
  }

  return null;
}

function toProviderStage(value: unknown): MatchStage {
  const stage = asString(value)?.toUpperCase();
  if (!stage) return "GROUP";

  if (stage === "LAST_32" || stage === "ROUND_OF_32") return "R32";
  if (stage === "LAST_16" || stage === "ROUND_OF_16") return "R16";
  if (stage === "QUARTER_FINALS") return "QF";
  if (stage === "SEMI_FINALS") return "SF";
  if (stage === "FINAL" || stage === "THIRD_PLACE") return "FINAL";
  if (stage === "GROUP_STAGE") return "GROUP";

  return "GROUP";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLiveOpsConfig(raw: any): LiveOpsConfig {
  return {
    enabled: raw?.enabled === true,
    provider: asProvider(raw?.provider) ?? DEFAULT_LIVE_OPS.provider,
    fixtureMaxMatches: asNonNegativeInteger(raw?.fixtureMaxMatches),
    fixtureCutoffIso: asIsoOrNull(raw?.fixtureCutoffIso),
  };
}

const TEAM_NAME_ALIASES: Record<string, string> = {
  CROATIA: "HRV",
  UNITEDSTATES: "USA",
  USA: "USA",
  KOREAREPUBLIC: "KOR",
  REPUBLICOFKOREA: "KOR",
  COTEDIVOIRE: "CIV",
  IVORYCOAST: "CIV",
};

function addAlias(
  lookup: Record<string, string>,
  key: string | null,
  teamId: string
) {
  if (!key) return;
  if (!lookup[key]) lookup[key] = teamId;
}

async function buildTeamLookup(): Promise<Record<string, string>> {
  const db = admin.firestore();
  const snap = await db.collection("teams").get();
  const lookup: Record<string, string> = {};

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const teamId =
      toUpperToken(data?.id) ?? toUpperToken(docSnap.id);
    if (!teamId) return;

    addAlias(lookup, teamId, teamId);
    addAlias(lookup, normalizeNameToken(data?.name), teamId);
  });

  Object.entries(TEAM_NAME_ALIASES).forEach(([alias, teamId]) => {
    addAlias(lookup, alias, teamId);
  });

  return lookup;
}

async function getTeamLookup(): Promise<Record<string, string>> {
  const now = Date.now();
  if (teamLookupCache && teamLookupCache.expiresAt > now) {
    return teamLookupCache.lookup;
  }

  const lookup = await buildTeamLookup();
  teamLookupCache = {
    lookup,
    expiresAt: now + TEAM_LOOKUP_TTL_MS,
  };
  return lookup;
}

function mapProviderTeamId(
  rawTeam: any,
  teamLookup: Record<string, string>
): string | null {
  const codeCandidates = [
    toUpperToken(rawTeam?.tla),
    toUpperToken(rawTeam?.shortName),
    toUpperToken(rawTeam?.name),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of codeCandidates) {
    const mapped = teamLookup[candidate];
    if (mapped) return mapped;
  }

  const nameCandidates = [
    normalizeNameToken(rawTeam?.name),
    normalizeNameToken(rawTeam?.shortName),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of nameCandidates) {
    const mapped = teamLookup[candidate];
    if (mapped) return mapped;
  }

  return null;
}

function toProviderMatch(raw: any): ProviderMatch | null {
  const matchId = asString(raw?.matchId);
  const homeTeamId = asString(raw?.homeTeamId);
  const awayTeamId = asString(raw?.awayTeamId);
  const status = asStatus(raw?.status);
  const stage = asStage(raw?.stage);
  const kickoffTime = asString(raw?.kickoffTime) ?? null;

  if (!matchId || !homeTeamId || !awayTeamId || !status || !stage) {
    return null;
  }

  return {
    matchId,
    homeTeamId,
    awayTeamId,
    homeScore: asNumberOrNull(raw?.homeScore),
    awayScore: asNumberOrNull(raw?.awayScore),
    status,
    stage,
    kickoffTime,
    homeRedCards: asNonNegativeNumber(raw?.homeRedCards),
    homeYellowCards: asNonNegativeNumber(raw?.homeYellowCards),
    awayRedCards: asNonNegativeNumber(raw?.awayRedCards),
    awayYellowCards: asNonNegativeNumber(raw?.awayYellowCards),
  };
}

function extractScore(
  score: any,
  side: "home" | "away"
): number | null {
  const candidates = [
    score?.fullTime?.[side],
    score?.regularTime?.[side],
    score?.extraTime?.[side],
    score?.halfTime?.[side],
  ];

  for (const value of candidates) {
    const parsed = asNumberOrNull(value);
    if (parsed !== null) return parsed;
  }

  return null;
}

async function fetchJsonWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxRetries: number
): Promise<any> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return await response.json();
      }

      const retryable = response.status === 429 || response.status >= 500;
      const bodyText = await response.text();
      const message = `[ingest] provider request failed (${response.status}): ${bodyText.slice(0, 240)}`;

      if (retryable && attempt < maxRetries) {
        await sleep((attempt + 1) * 1000);
        continue;
      }

      throw new Error(message);
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt >= maxRetries) break;
      await sleep((attempt + 1) * 1000);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("[ingest] provider request failed.");
}

function filterAndLimitMatches(
  matches: ProviderMatch[],
  options: { maxMatches: number; cutoffIso: string | null }
): ProviderMatch[] {
  const cutoffIso = options.cutoffIso;
  const filteredByCutoff = cutoffIso
    ? matches.filter((match) => {
        if (!match.kickoffTime) return false;
        return match.kickoffTime <= cutoffIso;
      })
    : matches;

  const sorted = [...filteredByCutoff].sort((a, b) =>
    (a.kickoffTime ?? "").localeCompare(b.kickoffTime ?? "")
  );

  return options.maxMatches > 0
    ? sorted.slice(0, options.maxMatches)
    : sorted;
}

async function getFootballDataMatches(
  options: { maxMatches: number; cutoffIso: string | null }
): Promise<ProviderMatch[]> {
  const token = asString(FOOTBALL_DATA_TOKEN.value()) ??
    asString(process.env.FOOTBALL_DATA_TOKEN);
  if (!token) {
    console.warn("[ingest] FOOTBALL_DATA_TOKEN missing. Skipping provider ingest.");
    return [];
  }

  const base = asString(process.env.FOOTBALL_DATA_API_BASE) ??
    FOOTBALL_DATA_BASE_DEFAULT;
  const competition = asString(process.env.FOOTBALL_DATA_COMPETITION) ??
    FOOTBALL_DATA_COMPETITION_DEFAULT;
  const statuses = asString(process.env.FOOTBALL_DATA_STATUSES) ??
    "SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED";
  const timeoutMs = asNonNegativeInteger(
    Number(process.env.PROVIDER_TIMEOUT_MS ?? PROVIDER_TIMEOUT_MS_DEFAULT)
  ) || PROVIDER_TIMEOUT_MS_DEFAULT;
  const maxRetries = asNonNegativeInteger(
    Number(process.env.PROVIDER_MAX_RETRIES ?? PROVIDER_MAX_RETRIES_DEFAULT)
  );

  const baseUrl = base.replace(/\/+$/, "");
  const url = `${baseUrl}/competitions/${encodeURIComponent(competition)}/matches?status=${encodeURIComponent(statuses)}`;

  const payload = await fetchJsonWithRetry(
    url,
    {
      method: "GET",
      headers: {
        "X-Auth-Token": token,
        "Accept": "application/json",
      },
    },
    timeoutMs,
    maxRetries
  );

  const rawMatches = Array.isArray(payload?.matches) ? payload.matches : [];
  if (!rawMatches.length) return [];

  const teamLookup = await getTeamLookup();
  const mapped: ProviderMatch[] = [];

  rawMatches.forEach((raw: any) => {
    const rawId = raw?.id;
    const matchId =
      typeof rawId === "number" || typeof rawId === "string"
        ? `fd-${String(rawId)}`
        : null;
    const homeTeamId = mapProviderTeamId(raw?.homeTeam, teamLookup);
    const awayTeamId = mapProviderTeamId(raw?.awayTeam, teamLookup);
    const status = toProviderStatus(raw?.status);
    const stage = toProviderStage(raw?.stage);

    if (!matchId || !homeTeamId || !awayTeamId || !status) {
      return;
    }

    mapped.push({
      matchId,
      homeTeamId,
      awayTeamId,
      homeScore: extractScore(raw?.score, "home"),
      awayScore: extractScore(raw?.score, "away"),
      status,
      stage,
      kickoffTime: asIsoOrNull(raw?.utcDate),
      homeRedCards: 0,
      homeYellowCards: 0,
      awayRedCards: 0,
      awayYellowCards: 0,
    });
  });

  const limited = filterAndLimitMatches(mapped, options);
  console.log(
    `[ingest] provider loaded ${limited.length} mapped matches` +
      ` (competition ${competition})` +
      (options.cutoffIso ? ` (cutoff ${options.cutoffIso})` : "") +
      (options.maxMatches > 0 ? ` (max ${options.maxMatches})` : "")
  );
  return limited;
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
    const rawMatches: any[] = [];
    return rawMatches
      .map((item) => toProviderMatch(item))
      .filter((item): item is ProviderMatch => Boolean(item));
  }

  if (provider === "fixture") {
    return getFixtureMatches({ maxMatches, cutoffIso });
  }

  if (provider === "provider") {
    try {
      return await getFootballDataMatches({ maxMatches, cutoffIso });
    } catch (err) {
      console.error("[ingest] provider fetch failed:", err);
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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message.trim();
  }

  if (typeof err === "string" && err.trim().length > 0) {
    return err.trim();
  }

  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== "{}") {
      return serialized.slice(0, 1000);
    }
  } catch {
    // Ignore serialization failures and use fallback.
  }

  return "Unknown ingest error.";
}

async function writeLiveOpsHealth(data: {
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
      const current = snap.exists ? (snap.data() as any) : {};
      const currentRunsRaw = Array.isArray(current?.recentRuns)
        ? current.recentRuns
        : [];

      const currentRuns = currentRunsRaw
        .map((run: any) => {
          const at = asIsoOrNull(run?.at);
          const runStatus =
            run?.status === "success" || run?.status === "error"
              ? (run.status as LiveOpsRunStatus)
              : null;
          const runProvider = asProvider(run?.provider);

          if (!at || !runStatus || !runProvider) return null;

          return {
            at,
            status: runStatus,
            provider: runProvider,
            matches: asNonNegativeInteger(run?.matches),
            updated: asNonNegativeInteger(run?.updated),
            errorMessage:
              typeof run?.errorMessage === "string"
                ? run.errorMessage.slice(0, 1000)
                : null,
          };
        })
        .filter(Boolean) as Array<{
        at: string;
        status: LiveOpsRunStatus;
        provider: LiveScoresProvider;
        matches: number;
        updated: number;
        errorMessage: string | null;
      }>;

      const nextRun = {
        at: runAtIso,
        status,
        provider: data.provider,
        matches,
        updated,
        errorMessage: safeErrorMessage,
      };

      const currentFailures = asNonNegativeInteger(current?.consecutiveFailures);
      const consecutiveFailures = hasError ? currentFailures + 1 : 0;

      const payload: Record<string, unknown> = {
        lastRunAt: now,
        lastRunAtIso: runAtIso,
        lastRunProvider: data.provider,
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

function isDifferent(
  existing: FirebaseFirestore.DocumentData | undefined,
  incoming: ProviderMatch
): boolean {
  if (!existing) return true;

  const fields: Array<keyof ProviderMatch> = [
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
  ];

  return fields.some((field) => {
    const current = existing[field];
    const next = incoming[field];
    return current !== next;
  });
}

type IngestOptions = {
  source: "provider" | "fixture";
  initiatedBy: string;
};

async function applyMatchUpdates(
  matches: ProviderMatch[],
  options: IngestOptions
): Promise<{ updated: number; matches: number }> {
  if (!matches.length) {
    return { updated: 0, matches: 0 };
  }

  const db = admin.firestore();
  const refs = matches.map((match) => db.collection("matches").doc(match.matchId));
  const snaps = await db.getAll(...refs);

  const existingById: Record<string, FirebaseFirestore.DocumentData | undefined> =
    {};

  snaps.forEach((snap) => {
    existingById[snap.id] = snap.exists ? snap.data() : undefined;
  });

  const updates: Array<{ ref: FirebaseFirestore.DocumentReference; data: any }> =
    [];

  matches.forEach((match) => {
    const existing = existingById[match.matchId];
    if (!isDifferent(existing, match)) return;

    updates.push({
      ref: db.collection("matches").doc(match.matchId),
      data: {
        ...match,
        source: options.source,
        lastUpdated: FieldValue.serverTimestamp(),
      },
    });
  });

  if (!updates.length) {
    return { updated: 0, matches: matches.length };
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

  await recomputeScoresCore({
    includeLive: true,
    scoringVersion: "v1",
    initiatedBy: options.initiatedBy,
  });

  return { updated: updates.length, matches: matches.length };
}

async function countFixtureMatches(): Promise<number> {
  const db = admin.firestore();
  const snap = await db
    .collection("matches")
    .where("source", "==", "fixture")
    .get();
  return snap.size;
}

async function deleteFixtureMatches(): Promise<number> {
  const db = admin.firestore();
  let deleted = 0;

  while (true) {
    const snap = await db
      .collection("matches")
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
    region: REGION,
    schedule: SCHEDULE,
    timeZone: "UTC",
    secrets: [FOOTBALL_DATA_TOKEN],
  },
  async (_event: ScheduledEvent) => {
    const liveOps = await getLiveOpsConfig();
    if (!liveOps.enabled) {
      console.log("[ingest] liveOps disabled. Skipping scheduled ingest.");
      return;
    }

    try {
      const matches = await fetchProviderMatches({
        provider: liveOps.provider,
        maxMatches: liveOps.fixtureMaxMatches,
        cutoffIso: liveOps.fixtureCutoffIso,
      });
      const source = liveOps.provider === "fixture" ? "fixture" : "provider";
      const result = matches.length
        ? await applyMatchUpdates(matches, {
            source,
            initiatedBy: "scheduler",
          })
        : { updated: 0, matches: 0 };

      await writeLiveOpsHealth({
        provider: liveOps.provider,
        matches: result.matches,
        updated: result.updated,
        errorMessage: null,
      });
    } catch (err) {
      console.error("[ingest] scheduled ingest failed:", err);
      await writeLiveOpsHealth({
        provider: liveOps.provider,
        errorMessage: getErrorMessage(err),
      });
    }
  }
);

export const adminIngestFixture = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const maxMatches = Number(request.data?.maxMatches ?? 0);
    const cutoffIso = asString(request.data?.cutoffIso) ?? null;
    const dryRun = request.data?.dryRun === true;

    const matches = getFixtureMatches({ maxMatches, cutoffIso });

    if (dryRun) {
      return {
        ok: true,
        matches: matches.length,
        updated: 0,
        dryRun: true,
      };
    }

    const result = await applyMatchUpdates(matches, {
      source: "fixture",
      initiatedBy: request.auth?.uid ?? "admin",
    });

    return {
      ok: true,
      ...result,
    };
  }
);

export const adminResetFixtureIngest = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const maxMatches = Number(request.data?.maxMatches ?? 0);
    const cutoffIso = asString(request.data?.cutoffIso) ?? null;
    const dryRun = request.data?.dryRun === true;

    const matches = getFixtureMatches({ maxMatches, cutoffIso });
    const existingFixtureMatches = await countFixtureMatches();

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        existingFixtureMatches,
        willDelete: existingFixtureMatches,
        willIngest: matches.length,
      };
    }

    const deletedFixtureMatches = await deleteFixtureMatches();
    const result = await applyMatchUpdates(matches, {
      source: "fixture",
      initiatedBy: request.auth?.uid ?? "admin",
    });

    if (!matches.length || result.updated === 0) {
      await recomputeScoresCore({
        includeLive: true,
        scoringVersion: "v1",
        initiatedBy: request.auth?.uid ?? "admin",
      });
    }

    return {
      ok: true,
      deletedFixtureMatches,
      ...result,
    };
  }
);

export const setLiveOpsSettings = onCall(
  { region: REGION, secrets: [FOOTBALL_DATA_TOKEN] },
  async (request) => {
    const auth = requireAdmin(request);
    const payload = request.data ?? {};

    const providerInput = payload.provider;
    const provider = asProvider(providerInput);
    if (!provider) {
      throw new HttpsError(
        "invalid-argument",
        "provider must be one of: stub, fixture, provider."
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

    const enabled = payload.enabled === true;

    if (
      enabled &&
      provider === "provider" &&
      !(
        asString(FOOTBALL_DATA_TOKEN.value()) ??
        asString(process.env.FOOTBALL_DATA_TOKEN)
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        "FOOTBALL_DATA_TOKEN is required before enabling provider automation."
      );
    }

    const db = admin.firestore();
    await db.collection("settings").doc("liveOps").set(
      {
        enabled,
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
      provider,
      fixtureMaxMatches,
      fixtureCutoffIso,
    };
  }
);
