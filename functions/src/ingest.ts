import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule, type ScheduledEvent } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
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
import { getFixtureReplayWave } from "./providers/fixtureReplayProvider";
import { getLocalLiveSimulatorWave } from "./providers/localLiveSimulatorProvider";
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
} from "./providers/providerTypes";

const REGION = "asia-southeast1";
const SCHEDULE = "every 10 minutes";
const FOOTBALL_DATA_BASE_DEFAULT = "https://api.football-data.org/v4";
const FOOTBALL_DATA_COMPETITION_DEFAULT = "WC";
const SPORTMONKS_BASE_DEFAULT = "https://api.sportmonks.com/v3/football";
const SPORTMONKS_SEASON_ID_DEFAULT = "26618";
const PROVIDER_TIMEOUT_MS_DEFAULT = 12_000;
const PROVIDER_MAX_RETRIES_DEFAULT = 1;
const TEAM_LOOKUP_TTL_MS = 5 * 60 * 1000;
const FOOTBALL_DATA_TOKEN = defineSecret("FOOTBALL_DATA_TOKEN");
const SPORTMONKS_TOKEN = defineSecret("SPORTMONKS_TOKEN");

type LiveScoresProvider =
  | "stub"
  | "fixture"
  | "football-data"
  | "sportmonks";
type LiveOpsRunStatus = "success" | "error";
type LiveOpsMode = "disabled" | "shadow" | "staging" | "production";

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

type ApplyMatchUpdatesResult = {
  updated: number;
  matches: number;
  quarantined: number;
};

type PublicRehearsalResetResult = {
  deletedMatches: number;
  deletedTransferEvents: number;
  resetUsers: number;
  resetTeams: number;
  deletedLeaderboard: boolean;
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

let teamLookupCache:
  | { expiresAt: number; lookup: Record<string, string> }
  | null = null;

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
    value === "football-data" ||
    value === "sportmonks"
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

function toSportmonksStatus(value: unknown): MatchStatus | null {
  const status = asString(value)?.toUpperCase();
  if (!status) return null;

  if (
    status === "LIVE" ||
    status.startsWith("INPLAY") ||
    status === "HT" ||
    status === "BREAK"
  ) {
    return "LIVE";
  }
  if (
    status === "FT" ||
    status === "AET" ||
    status === "FT_PEN" ||
    status === "AFTER_PENALTIES"
  ) {
    return "FINISHED";
  }
  if (
    status === "NS" ||
    status === "POSTP" ||
    status === "SUSP" ||
    status === "DELAYED" ||
    status === "TBA" ||
    status === "CANCL"
  ) {
    return "SCHEDULED";
  }

  return null;
}

function toSportmonksStage(value: unknown): MatchStage {
  const stage = asString(value)?.toUpperCase();
  if (!stage) return "GROUP";

  if (stage.includes("GROUP")) return "GROUP";
  if (stage.includes("ROUND OF 32") || stage.includes("LAST 32")) return "R32";
  if (stage.includes("ROUND OF 16") || stage.includes("LAST 16")) return "R16";
  if (stage.includes("QUARTER")) return "QF";
  if (stage.includes("SEMI")) return "SF";
  if (stage.includes("FINAL") || stage.includes("THIRD")) return "FINAL";

  return "GROUP";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const data = docSnap.data() as Record<string, unknown>;
    const teamId =
      toUpperToken(data.id) ?? toUpperToken(docSnap.id);
    if (!teamId) return;

    addAlias(lookup, teamId, teamId);
    addAlias(lookup, normalizeNameToken(data.name), teamId);
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
  rawTeam: unknown,
  teamLookup: Record<string, string>
): string | null {
  const team = isRecord(rawTeam) ? rawTeam : {};
  const codeCandidates = [
    toUpperToken(team.tla),
    toUpperToken(team.shortName),
    toUpperToken(team.name),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of codeCandidates) {
    const mapped = teamLookup[candidate];
    if (mapped) return mapped;
  }

  const nameCandidates = [
    normalizeNameToken(team.name),
    normalizeNameToken(team.shortName),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of nameCandidates) {
    const mapped = teamLookup[candidate];
    if (mapped) return mapped;
  }

  return null;
}

function mapSportmonksParticipantId(
  rawParticipant: unknown,
  teamLookup: Record<string, string>
): string | null {
  const participant = isRecord(rawParticipant) ? rawParticipant : {};
  const candidates = [
    toUpperToken(participant.short_code),
    toUpperToken(participant.name),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const mapped = teamLookup[candidate];
    if (mapped) return mapped;
  }

  const nameCandidates = [normalizeNameToken(participant.name)]
    .filter((value): value is string => Boolean(value));

  for (const candidate of nameCandidates) {
    const mapped = teamLookup[candidate];
    if (mapped) return mapped;
  }

  return null;
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

function extractScore(
  score: unknown,
  side: "home" | "away"
): number | null {
  const scoreRecord = isRecord(score) ? score : {};
  const fullTime = isRecord(scoreRecord.fullTime) ? scoreRecord.fullTime : {};
  const regularTime = isRecord(scoreRecord.regularTime) ? scoreRecord.regularTime : {};
  const extraTime = isRecord(scoreRecord.extraTime) ? scoreRecord.extraTime : {};
  const halfTime = isRecord(scoreRecord.halfTime) ? scoreRecord.halfTime : {};

  const candidates = [
    fullTime[side],
    regularTime[side],
    extraTime[side],
    halfTime[side],
  ];

  for (const value of candidates) {
    const parsed = asNumberOrNull(value);
    if (parsed !== null) return parsed;
  }

  return null;
}

function extractSportmonksCurrentScore(rawScores: unknown): {
  homeScore: number | null;
  awayScore: number | null;
} {
  const scores = Array.isArray(rawScores) ? rawScores : [];
  let homeScore: number | null = null;
  let awayScore: number | null = null;

  scores.forEach((entry) => {
    if (!isRecord(entry)) return;
    if (asString(entry.description)?.toUpperCase() !== "CURRENT") return;
    const score = isRecord(entry.score) ? entry.score : {};
    const participant = asString(score.participant)?.toLowerCase();
    const goals = asNumberOrNull(score.goals);
    if (participant === "home") homeScore = goals;
    if (participant === "away") awayScore = goals;
  });

  return { homeScore, awayScore };
}

function extractSportmonksCardTotals(
  rawEvents: unknown,
  homeParticipantId: number | null,
  awayParticipantId: number | null
): {
  homeRedCards: number;
  awayRedCards: number;
  homeYellowCards: number;
  awayYellowCards: number;
} {
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  let homeRedCards = 0;
  let awayRedCards = 0;
  let homeYellowCards = 0;
  let awayYellowCards = 0;

  events.forEach((entry) => {
    if (!isRecord(entry)) return;
    const participantId =
      typeof entry.participant_id === "number" && Number.isFinite(entry.participant_id)
        ? Math.floor(entry.participant_id)
        : null;
    const type = isRecord(entry.type) ? entry.type : {};
    const descriptor = [
      asString(type.developer_name),
      asString(type.name),
      asString(entry.info),
      asString(entry.addition),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toUpperCase();

    if (!descriptor) return;
    const isRed = descriptor.includes("RED");
    const isYellow = descriptor.includes("YELLOW");
    if (!isRed && !isYellow) return;

    if (participantId !== null && participantId === homeParticipantId) {
      if (isRed) homeRedCards += 1;
      if (isYellow) homeYellowCards += 1;
    }
    if (participantId !== null && participantId === awayParticipantId) {
      if (isRed) awayRedCards += 1;
      if (isYellow) awayYellowCards += 1;
    }
  });

  return {
    homeRedCards,
    awayRedCards,
    homeYellowCards,
    awayYellowCards,
  };
}

async function fetchJsonWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxRetries: number
): Promise<unknown> {
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

  const payloadRecord = isRecord(payload) ? payload : {};
  const rawMatches = Array.isArray(payloadRecord.matches)
    ? payloadRecord.matches
    : [];
  if (!rawMatches.length) return [];

  const teamLookup = await getTeamLookup();
  const mapped: ProviderMatch[] = [];

  rawMatches.forEach((raw: unknown) => {
    if (!isRecord(raw)) return;
    const rawId = raw.id;
    const matchId =
      typeof rawId === "number" || typeof rawId === "string"
        ? `fd-${String(rawId)}`
        : null;
    const homeTeamId = mapProviderTeamId(raw.homeTeam, teamLookup);
    const awayTeamId = mapProviderTeamId(raw.awayTeam, teamLookup);
    const status = toProviderStatus(raw.status);
    const stage = toProviderStage(raw.stage);

    if (!matchId || !homeTeamId || !awayTeamId || !status) {
      return;
    }

    mapped.push({
      matchId,
      homeTeamId,
      awayTeamId,
      homeScore: extractScore(raw.score, "home"),
      awayScore: extractScore(raw.score, "away"),
      status,
      stage,
      kickoffTime: asIsoOrNull(raw.utcDate),
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

async function getSportmonksMatches(
  options: { maxMatches: number; cutoffIso: string | null }
): Promise<ProviderMatch[]> {
  const token = asString(SPORTMONKS_TOKEN.value()) ??
    asString(process.env.SPORTMONKS_TOKEN);
  if (!token) {
    console.warn("[ingest] SPORTMONKS_TOKEN missing. Skipping Sportmonks ingest.");
    return [];
  }

  const base = asString(process.env.SPORTMONKS_API_BASE) ?? SPORTMONKS_BASE_DEFAULT;
  const seasonId =
    asString(process.env.SPORTMONKS_SEASON_ID) ?? SPORTMONKS_SEASON_ID_DEFAULT;
  const timeoutMs = asNonNegativeInteger(
    Number(process.env.PROVIDER_TIMEOUT_MS ?? PROVIDER_TIMEOUT_MS_DEFAULT)
  ) || PROVIDER_TIMEOUT_MS_DEFAULT;
  const maxRetries = asNonNegativeInteger(
    Number(process.env.PROVIDER_MAX_RETRIES ?? PROVIDER_MAX_RETRIES_DEFAULT)
  );
  const include = [
    "fixtures.participants",
    "fixtures.scores",
    "fixtures.events.type",
    "fixtures.state",
    "fixtures.stage",
  ].join(";");

  const baseUrl = base.replace(/\/+$/, "");
  const url =
    `${baseUrl}/seasons/${encodeURIComponent(seasonId)}` +
    `?api_token=${encodeURIComponent(token)}&include=${encodeURIComponent(include)}`;

  const payload = await fetchJsonWithRetry(
    url,
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    },
    timeoutMs,
    maxRetries
  );

  const payloadRecord = isRecord(payload) ? payload : {};
  const season = isRecord(payloadRecord.data) ? payloadRecord.data : {};
  const rawMatches = Array.isArray(season.fixtures) ? season.fixtures : [];
  if (!rawMatches.length) return [];

  const teamLookup = await getTeamLookup();
  const mapped: ProviderMatch[] = [];

  rawMatches.forEach((raw: unknown) => {
    if (!isRecord(raw)) return;
    const participants = Array.isArray(raw.participants) ? raw.participants : [];
    const home = participants.find((entry) =>
      isRecord(entry) && isRecord(entry.meta) && entry.meta.location === "home"
    );
    const away = participants.find((entry) =>
      isRecord(entry) && isRecord(entry.meta) && entry.meta.location === "away"
    );

    const matchId =
      typeof raw.id === "number" || typeof raw.id === "string"
        ? `sm-${String(raw.id)}`
        : null;
    const homeTeamId = mapSportmonksParticipantId(home, teamLookup);
    const awayTeamId = mapSportmonksParticipantId(away, teamLookup);
    const state = isRecord(raw.state) ? raw.state : {};
    const stage = isRecord(raw.stage) ? raw.stage : {};
    const status = toSportmonksStatus(
      asString(state.state) ?? asString(state.short_name) ?? asString(state.name)
    );
    const normalizedStage = toSportmonksStage(
      asString(stage.name) ?? asString(stage.developer_name) ?? asString(raw.name)
    );
    const { homeScore, awayScore } = extractSportmonksCurrentScore(raw.scores);
    const homeParticipantId =
      isRecord(home) && typeof home.id === "number" ? Math.floor(home.id) : null;
    const awayParticipantId =
      isRecord(away) && typeof away.id === "number" ? Math.floor(away.id) : null;
    const cards = extractSportmonksCardTotals(
      raw.events,
      homeParticipantId,
      awayParticipantId
    );

    if (!matchId || !homeTeamId || !awayTeamId || !status) {
      return;
    }

    mapped.push({
      matchId,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      status,
      stage: normalizedStage,
      kickoffTime: asIsoOrNull(raw.starting_at),
      homeRedCards: cards.homeRedCards,
      homeYellowCards: cards.homeYellowCards,
      awayRedCards: cards.awayRedCards,
      awayYellowCards: cards.awayYellowCards,
    });
  });

  const limited = filterAndLimitMatches(mapped, options);
  console.log(
    `[ingest] sportmonks loaded ${limited.length} mapped matches` +
      ` (season ${seasonId})` +
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

  if (provider === "sportmonks") {
    try {
      return await getSportmonksMatches({ maxMatches, cutoffIso });
    } catch (err) {
      console.error("[ingest] sportmonks fetch failed:", err);
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

async function writeLiveOpsHealth(data: {
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

/**
 * Load pre-tournament matches from fixture file
 * Used to provide match history before tournament starts
 */
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
  if (source === "sportmonks") return "sportmonks";
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

type IngestOptions = {
  source: "football-data" | "sportmonks" | "fixture";
  initiatedBy: string;
  collectionName?: "matches" | "shadowMatches";
  recompute?: boolean;
  recomputeTarget?: "public" | "shadow";
};

async function applyNormalizedMatchUpdates(
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

async function countCollectionDocs(collectionName: string): Promise<number> {
  const db = admin.firestore();
  const snap = await db.collection(collectionName).count().get();
  return snap.data().count;
}

async function deleteCollectionDocs(collectionName: string): Promise<number> {
  const db = admin.firestore();
  let deleted = 0;

  while (true) {
    const snap = await db.collection(collectionName).limit(400).get();
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

async function resetPublicRehearsalState(): Promise<PublicRehearsalResetResult> {
  const db = admin.firestore();
  const [deletedMatches, deletedTransferEvents] = await Promise.all([
    deleteCollectionDocs("matches"),
    deleteCollectionDocs("transferEvents"),
  ]);

  const [usersSnap, teamsSnap, leaderboardSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("teams").get(),
    db.collection("leaderboard").doc("current").get(),
  ]);

  const maxBatch = 450;
  let batch = db.batch();
  let writes = 0;
  const commitIfFull = async () => {
    if (writes < maxBatch) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const teamDoc of teamsSnap.docs) {
    batch.set(
      teamDoc.ref,
      {
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        cleanSheets: 0,
        redCards: 0,
        yellowCards: 0,
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    writes += 1;
    await commitIfFull();
  }

  for (const userDoc of usersSnap.docs) {
    batch.set(
      userDoc.ref,
      {
        totalScore: 0,
        transferPenaltyPoints: 0,
        scoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    writes += 1;
    await commitIfFull();
  }

  if (leaderboardSnap.exists) {
    batch.delete(leaderboardSnap.ref);
    writes += 1;
    await commitIfFull();
  }

  batch.delete(db.collection("ingestHealth").doc("current"));
  writes += 1;
  await commitIfFull();

  batch.set(
    db.collection("settings").doc("liveSimulator"),
    {
      nextWave: 0,
      totalWaves: 4,
      lastResetAt: FieldValue.serverTimestamp(),
      lastAppliedWave: null,
      lastLabel: null,
      done: false,
    },
    { merge: true }
  );
  writes += 1;

  if (writes > 0) {
    await batch.commit();
  }

  return {
    deletedMatches,
    deletedTransferEvents,
    resetUsers: usersSnap.size,
    resetTeams: teamsSnap.size,
    deletedLeaderboard: leaderboardSnap.exists,
  };
}

export const adminResetPublicRehearsalState = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const dryRun = request.data?.dryRun === true;
    const [matches, transferEvents, users, teams] = await Promise.all([
      countCollectionDocs("matches"),
      countCollectionDocs("transferEvents"),
      countCollectionDocs("users"),
      countCollectionDocs("teams"),
    ]);

    if (dryRun) {
      const leaderboardSnap = await admin
        .firestore()
        .collection("leaderboard")
        .doc("current")
        .get();
      return {
        ok: true,
        dryRun: true,
        willDeleteMatches: matches,
        willDeleteTransferEvents: transferEvents,
        willResetUsers: users,
        willResetTeams: teams,
        willDeleteLeaderboard: leaderboardSnap.exists,
      };
    }

    const result = await resetPublicRehearsalState();
    await writeLiveOpsHealth({
      mode: "production",
      provider: "fixture",
      matches: 0,
      updated: 0,
      errorMessage: null,
    });

    return {
      ok: true,
      ...result,
    };
  }
);

export const adminRunLocalLiveSimulatorWave = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const db = admin.firestore();
    const stateRef = db.collection("settings").doc("liveSimulator");
    const stateSnap = await stateRef.get();
    const state = (stateSnap.exists ? stateSnap.data() : {}) as Record<string, unknown>;
    const requestedWave = Number(request.data?.waveIndex);
    const storedNextWave =
      typeof state.nextWave === "number" && Number.isFinite(state.nextWave)
        ? Math.floor(state.nextWave)
        : 0;
    const waveIndex = Number.isFinite(requestedWave)
      ? Math.max(0, Math.floor(requestedWave))
      : storedNextWave;
    const wave = getLocalLiveSimulatorWave({ waveIndex });

    await recordIngestAttempt({
      activeProvider: "local-live-sim",
      mode: "production",
    });

    try {
      const result = await applyNormalizedMatchUpdates(wave.updates, {
        source: "fixture",
        initiatedBy: request.auth?.uid ?? "admin",
        collectionName: "matches",
        recompute: true,
        recomputeTarget: "public",
      });

      await stateRef.set(
        {
          nextWave: wave.done ? wave.totalWaves - 1 : wave.waveIndex + 1,
          totalWaves: wave.totalWaves,
          lastAppliedWave: wave.waveIndex,
          lastLabel: wave.label,
          done: wave.done,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: request.auth?.uid ?? "admin",
        },
        { merge: true }
      );

      await writeLiveOpsHealth({
        mode: "production",
        provider: "fixture",
        matches: result.matches,
        updated: result.updated,
        errorMessage: null,
      });
      await recordIngestSuccess({
        activeProvider: "local-live-sim",
        mode: "production",
      });

      return {
        ok: true,
        waveIndex: wave.waveIndex,
        label: wave.label,
        totalWaves: wave.totalWaves,
        done: wave.done,
        nextWave: wave.done ? wave.totalWaves - 1 : wave.waveIndex + 1,
        ...result,
      };
    } catch (err) {
      const message = getErrorMessage(err);
      await writeLiveOpsHealth({
        mode: "production",
        provider: "fixture",
        errorMessage: message,
      });
      await recordIngestError({
        activeProvider: "local-live-sim",
        errorMessage: message,
        mode: "production",
      });
      throw err;
    }
  }
);

export const ingestLiveScores = onSchedule(
  {
    region: REGION,
    schedule: SCHEDULE,
    timeZone: "UTC",
    secrets: [FOOTBALL_DATA_TOKEN, SPORTMONKS_TOKEN],
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
          : liveOps.provider === "sportmonks"
          ? "sportmonks"
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
  { region: REGION },
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
  { region: REGION },
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

/**
 * Import pre-tournament match data (friendlies and qualifiers)
 * Provides match history from tournament start
 */
export const adminIngestPreTournament = onCall(
  { region: REGION },
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
  { region: REGION, secrets: [FOOTBALL_DATA_TOKEN, SPORTMONKS_TOKEN] },
  async (request) => {
    requireAdmin(request);

    const provider = asProvider(request.data?.provider);
    if (!provider || provider === "stub" || provider === "fixture") {
      throw new HttpsError(
        "invalid-argument",
        "provider must be one of: football-data, sportmonks."
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

export const adminReplayFixtureWave = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const db = admin.firestore();
    const stateRef = db.collection("settings").doc("fixtureReplay");
    const stateSnap = await stateRef.get();
    const state = (stateSnap.exists ? stateSnap.data() : {}) as Record<string, unknown>;

    const requestedCursor = Number(request.data?.cursor);
    const cursor = Number.isFinite(requestedCursor)
      ? Math.max(0, Math.floor(requestedCursor))
      : typeof state.cursor === "number" && Number.isFinite(state.cursor)
      ? Math.max(0, Math.floor(state.cursor))
      : 0;

    const requestedWaveSize = Number(request.data?.waveSize);
    const waveSize = Number.isFinite(requestedWaveSize)
      ? Math.max(1, Math.floor(requestedWaveSize))
      : 4;

    const wave = getFixtureReplayWave({ cursor, waveSize });
    const result = await applyNormalizedMatchUpdates(wave.updates, {
      source: "fixture",
      initiatedBy: request.auth?.uid ?? "admin",
      collectionName: "shadowMatches",
      recompute: false,
    });

    await stateRef.set(
      {
        cursor: wave.nextCursor,
        waveSize,
        total: wave.total,
        done: wave.done,
        lastRunAt: FieldValue.serverTimestamp(),
        lastRunBy: request.auth?.uid ?? "admin",
      },
      { merge: true }
    );

    return {
      ok: true,
      applied: result.updated,
      matches: result.matches,
      quarantined: result.quarantined,
      cursor,
      nextCursor: wave.nextCursor,
      total: wave.total,
      done: wave.done,
      target: "shadowMatches",
    };
  }
);

export const adminResetFixtureReplay = onCall(
  { region: REGION },
  async (request) => {
    requireAdmin(request);

    const db = admin.firestore();
    let deleted = 0;

    while (true) {
      const snap = await db.collection("shadowMatches").limit(400).get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        deleted += 1;
      });
      await batch.commit();
    }

    await db.collection("settings").doc("fixtureReplay").set(
      {
        cursor: 0,
        waveSize: null,
        total: null,
        done: false,
        lastResetAt: FieldValue.serverTimestamp(),
        lastResetBy: request.auth?.uid ?? "admin",
      },
      { merge: true }
    );

    return {
      ok: true,
      deleted,
      cursor: 0,
      target: "shadowMatches",
    };
  }
);

export const setLiveOpsSettings = onCall(
  { region: REGION, secrets: [FOOTBALL_DATA_TOKEN, SPORTMONKS_TOKEN] },
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
        "provider must be one of: stub, fixture, football-data, sportmonks."
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

    if (mode !== "disabled" && provider === "sportmonks") {
      if (
        !(
          asString(SPORTMONKS_TOKEN.value()) ??
          asString(process.env.SPORTMONKS_TOKEN)
        )
      ) {
        throw new HttpsError(
          "failed-precondition",
          "SPORTMONKS_TOKEN is required before enabling Sportmonks automation."
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
