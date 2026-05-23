import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import type { ProviderMatch } from "./providerTypes";

export const FOOTBALL_DATA_TOKEN = defineSecret("FOOTBALL_DATA_TOKEN");

export const FOOTBALL_DATA_BASE_DEFAULT = "https://api.football-data.org/v4";
export const FOOTBALL_DATA_COMPETITION_DEFAULT = "WC";
export const PROVIDER_TIMEOUT_MS_DEFAULT = 12_000;
export const PROVIDER_MAX_RETRIES_DEFAULT = 1;

const TEAM_LOOKUP_TTL_MS = 5 * 60 * 1000;

// ── tiny parsers (self-contained copies) ────────────────────────────────────

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── fetch ────────────────────────────────────────────────────────────────────

export async function fetchJsonWithRetry(
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
      const response = await fetch(url, { ...init, signal: controller.signal });
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

// ── match filtering ──────────────────────────────────────────────────────────

export function filterAndLimitMatches(
  matches: ProviderMatch[],
  options: { maxMatches: number; cutoffIso: string | null }
): ProviderMatch[] {
  const filteredByCutoff = options.cutoffIso
    ? matches.filter((m) => !!m.kickoffTime && m.kickoffTime <= options.cutoffIso!)
    : matches;

  const sorted = [...filteredByCutoff].sort((a, b) =>
    (a.kickoffTime ?? "").localeCompare(b.kickoffTime ?? "")
  );

  return options.maxMatches > 0 ? sorted.slice(0, options.maxMatches) : sorted;
}

// ── team lookup ──────────────────────────────────────────────────────────────

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

const TEAM_NAME_ALIASES: Record<string, string> = {
  // ── football-data.org TLA overrides (their code → our internal ID) ──────────
  // These fire first via toUpperToken(team.tla) in mapProviderTeamId,
  // so add the fd.org TLA as key and our ID as value where they differ.
  RSA: "ZAF",   // South Africa  (fd: RSA  → internal: ZAF)
  IRI: "IRN",   // IR Iran       (fd: IRI  → internal: IRN)
  SWI: "SUI",   // Switzerland   (fd: SWI  → internal: SUI)
  PAR: "PRY",   // Paraguay      (fd: PAR  → internal: PRY)
  HAI: "HTI",   // Haiti         (fd: HAI  → internal: HTI)
  HON: "HND",   // Honduras      (fd: HON  → internal: HND)
  TRI: "TTO",   // Trinidad      (fd: TRI  → internal: TTO)
  URU: "URY",   // Uruguay       (fd: URU  → internal: URY)
  BOL: "BOL",   // Bolivia       (keep same)
  VEN: "VEN",   // Venezuela
  CHI: "CHL",   // Chile         (fd: CHI  → internal: CHL)
  COL: "COL",   // Colombia
  PER: "PER",   // Peru
  ALG: "DZA",   // Algeria       (fd: ALG  → internal: DZA)
  CMR: "CMR",   // Cameroon
  GHA: "GHA",   // Ghana
  NGA: "NGA",   // Nigeria
  SEN: "SEN",   // Senegal
  CIV: "CIV",   // Côte d'Ivoire
  CAP: "CPV",   // Cabo Verde    (fd: CAP  → internal: CPV)
  CPV: "CPV",
  KSA: "SAU",   // Saudi Arabia  (fd: KSA  → internal: SAU)
  SAU: "SAU",
  UAE: "ARE",   // UAE           (fd: UAE  → internal: ARE)
  JOR: "JOR",   // Jordan
  OMA: "OMN",   // Oman          (fd: OMA  → internal: OMN)
  BHR: "BHR",   // Bahrain
  PHI: "PHL",   // Philippines   (fd: PHI  → internal: PHL)
  THA: "THA",   // Thailand
  VIE: "VNM",   // Vietnam       (fd: VIE  → internal: VNM)
  IND: "IND",   // India
  // ── name-based aliases (normalised, no spaces/punctuation) ──────────────────
  CROATIA: "HRV",
  UNITEDSTATES: "USA",
  USA: "USA",
  KOREAREPUBLIC: "KOR",
  REPUBLICOFKOREA: "KOR",
  SOUTHKOREA: "KOR",
  COTEDIVOIRE: "CIV",
  IVORYCOAST: "CIV",
  SOUTHAFRICA: "ZAF",
  SWITZERLAND: "SUI",
  PARAGUAY: "PRY",
  HAITI: "HTI",
  IRAN: "IRN",
  IRINIRAN: "IRN",
  CABOVERDE: "CPV",
  TURKIYE: "TUR",
  TURKEY: "TUR",
  NETHERLANDS: "NED",
  HOLLAND: "NED",
  BOSNIAANDHERZEGOVINA: "BIH",
  NEWZEALAND: "NZL",
  CURACAO: "CUW",
  ECUADOR: "ECU",
  SAUDIARABIA: "SAU",
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
    const teamId = toUpperToken(data.id) ?? toUpperToken(docSnap.id);
    if (!teamId) return;
    addAlias(lookup, teamId, teamId);
    addAlias(lookup, normalizeNameToken(data.name), teamId);
  });

  Object.entries(TEAM_NAME_ALIASES).forEach(([alias, teamId]) => {
    addAlias(lookup, alias, teamId);
  });

  return lookup;
}

let teamLookupCache: { expiresAt: number; lookup: Record<string, string> } | null = null;

export async function getTeamLookup(): Promise<Record<string, string>> {
  const now = Date.now();
  if (teamLookupCache && teamLookupCache.expiresAt > now) {
    return teamLookupCache.lookup;
  }
  const lookup = await buildTeamLookup();
  teamLookupCache = { lookup, expiresAt: now + TEAM_LOOKUP_TTL_MS };
  return lookup;
}

export function mapProviderTeamId(
  rawTeam: unknown,
  teamLookup: Record<string, string>
): string | null {
  const team = isRecord(rawTeam) ? rawTeam : {};
  const codeCandidates = [
    toUpperToken(team.tla),
    toUpperToken(team.shortName),
    toUpperToken(team.name),
  ].filter((v): v is string => Boolean(v));

  for (const candidate of codeCandidates) {
    const mapped = teamLookup[candidate];
    if (mapped) return mapped;
  }

  const nameCandidates = [
    normalizeNameToken(team.name),
    normalizeNameToken(team.shortName),
  ].filter((v): v is string => Boolean(v));

  for (const candidate of nameCandidates) {
    const mapped = teamLookup[candidate];
    if (mapped) return mapped;
  }

  return null;
}

// ── score extraction ─────────────────────────────────────────────────────────

export function extractScore(
  score: unknown,
  side: "home" | "away"
): number | null {
  const scoreRecord = isRecord(score) ? score : {};
  const fullTime = isRecord(scoreRecord.fullTime) ? scoreRecord.fullTime : {};
  const regularTime = isRecord(scoreRecord.regularTime) ? scoreRecord.regularTime : {};
  const extraTime = isRecord(scoreRecord.extraTime) ? scoreRecord.extraTime : {};
  const halfTime = isRecord(scoreRecord.halfTime) ? scoreRecord.halfTime : {};

  for (const bucket of [fullTime, regularTime, extraTime, halfTime]) {
    const parsed = asNumberOrNull(bucket[side]);
    if (parsed !== null) return parsed;
  }

  return null;
}
