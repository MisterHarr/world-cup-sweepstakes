import fixtures from "../fixtures/worldcup2022.json";
import type {
  MatchStage,
  MatchStatus,
  NormalizedMatchUpdate,
} from "./providerTypes";

type ReplayFixtureRow = {
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

function toNormalizedReplayUpdate(
  raw: ReplayFixtureRow,
  index: number
): NormalizedMatchUpdate | null {
  const matchId = asString(raw.matchId);
  const homeTeamId = asString(raw.homeTeamId);
  const awayTeamId = asString(raw.awayTeamId);
  const status = asStatus(raw.status);
  const stage = asStage(raw.stage);
  const kickoffTime = asString(raw.kickoffTime) ?? null;

  if (!matchId || !homeTeamId || !awayTeamId || !status || !stage) {
    return null;
  }

  const nowIso = new Date().toISOString();

  return {
    provider: "fixture-replay",
    providerMatchId: matchId,
    canonicalMatchId: matchId,
    homeTeamId,
    awayTeamId,
    kickoffTime,
    status,
    stage,
    homeScore: asNumberOrNull(raw.homeScore),
    awayScore: asNumberOrNull(raw.awayScore),
    homeRedCards: asNonNegativeNumber(raw.homeRedCards),
    homeYellowCards: asNonNegativeNumber(raw.homeYellowCards),
    awayRedCards: asNonNegativeNumber(raw.awayRedCards),
    awayYellowCards: asNonNegativeNumber(raw.awayYellowCards),
    providerUpdatedAt: nowIso,
    ingestReceivedAt: nowIso,
    revision: index + 1,
  };
}

function getReplayFixtures(): ReplayFixtureRow[] {
  return Array.isArray(fixtures) ? fixtures : [];
}

export function getFixtureReplayWave(options?: {
  cursor?: number;
  waveSize?: number;
}): {
  updates: NormalizedMatchUpdate[];
  nextCursor: number;
  total: number;
  done: boolean;
} {
  const cursor =
    typeof options?.cursor === "number" && Number.isFinite(options.cursor)
      ? Math.max(0, Math.floor(options.cursor))
      : 0;
  const waveSize =
    typeof options?.waveSize === "number" && Number.isFinite(options.waveSize)
      ? Math.max(1, Math.floor(options.waveSize))
      : 4;

  const raw = getReplayFixtures();
  const total = raw.length;
  const nextSlice = raw.slice(cursor, cursor + waveSize);
  const updates = nextSlice
    .map((row, idx) => toNormalizedReplayUpdate(row, cursor + idx))
    .filter((item): item is NormalizedMatchUpdate => item !== null);
  const nextCursor = Math.min(total, cursor + nextSlice.length);

  return {
    updates,
    nextCursor,
    total,
    done: nextCursor >= total,
  };
}
