// Shared types, constants, and pure utilities for admin/fixtures panels.

// ─── Firestore helpers ────────────────────────────────────────────────────────

export type FirestoreTimestampLike = {
  toDate: () => Date;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimestampLike(value: unknown): value is FirestoreTimestampLike {
  return isRecord(value) && typeof value.toDate === "function";
}

export function toIsoOrEmpty(value: unknown): string {
  if (!isTimestampLike(value)) return "";
  const date = value.toDate();
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString()
    : "";
}

export function toIsoOrString(value: unknown): string {
  const iso = toIsoOrEmpty(value);
  if (iso) return iso;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return "";
}

export function toLocalDateTimeInput(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
}

export function fromLocalDateTimeInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toMillisOrNull(value?: string): number | null {
  if (!value || typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return String(error);
}

export function asNonNegativeInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

// ─── Live ops ─────────────────────────────────────────────────────────────────

export type LiveOpsProvider = "stub" | "fixture" | "football-data" | "sportmonks";
export type LiveOpsMode = "disabled" | "shadow" | "staging" | "production";

export type LiveOpsRun = {
  at: string;
  status: "success" | "error";
  provider: LiveOpsProvider;
  matches: number;
  updated: number;
  errorMessage?: string;
};

export type LiveOpsState = {
  enabled: boolean;
  mode: LiveOpsMode;
  provider: LiveOpsProvider;
  fixtureMaxMatches: number;
  fixtureCutoffIso: string;
  updatedBy?: string;
  updatedAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  lastRunAt?: string;
  lastRunStatus?: "success" | "error";
  lastRunProvider?: LiveOpsProvider;
  lastRunMatches?: number;
  lastRunUpdated?: number;
  consecutiveFailures?: number;
  recentRuns?: LiveOpsRun[];
};

export const DEFAULT_LIVE_OPS: LiveOpsState = {
  enabled: false,
  mode: "disabled",
  provider: "fixture",
  fixtureMaxMatches: 0,
  fixtureCutoffIso: "",
  consecutiveFailures: 0,
  recentRuns: [],
};

export type SetLiveOpsSettingsPayload = {
  mode: LiveOpsMode;
  provider: LiveOpsProvider;
  fixtureMaxMatches: number;
  fixtureCutoffIso: string | null;
};

export const SCHEDULER_INTERVAL_MINUTES = 10;
export const STALE_AFTER_MINUTES = SCHEDULER_INTERVAL_MINUTES * 3;

export type IngestAlertLevel = "healthy" | "warning" | "critical";
export type IngestAlert = {
  level: IngestAlertLevel;
  label: "Healthy" | "Warning" | "Critical";
  message: string;
  stale: boolean;
};

export function asLiveOpsMode(value: unknown): LiveOpsMode | null {
  return value === "disabled" ||
    value === "shadow" ||
    value === "staging" ||
    value === "production"
    ? value
    : null;
}

export function getLiveOpsModeMeta(mode: LiveOpsMode) {
  if (mode === "production") {
    return {
      badge: "PRODUCTION",
      classes: "border-rose-500/50 bg-rose-500/15 text-rose-200",
      description: "Writes to public matches and recomputes the public leaderboard.",
    };
  }
  if (mode === "shadow") {
    return {
      badge: "SHADOW",
      classes: "border-amber-500/50 bg-amber-500/15 text-amber-200",
      description: "Writes to shadowMatches only. Public scores stay untouched.",
    };
  }
  if (mode === "staging") {
    return {
      badge: "STAGING",
      classes: "border-sky-500/50 bg-sky-500/15 text-sky-200",
      description: "Uses the safe shadow write path with staging labeling for rehearsal runs.",
    };
  }
  return {
    badge: "DISABLED",
    classes: "border-slate-700/70 bg-slate-900/70 text-slate-300",
    description: "Scheduler is off and manual ingest is blocked until a mode is selected.",
  };
}

export function buildIngestAlert(state: LiveOpsState): IngestAlert {
  if (state.mode === "disabled") {
    return {
      level: "healthy",
      label: "Healthy",
      message: "Automation is disabled (cost-safe mode).",
      stale: false,
    };
  }

  const failures = Math.max(0, Number(state.consecutiveFailures ?? 0));
  const lastRunMs = toMillisOrNull(state.lastRunAt);
  const stale =
    lastRunMs === null ||
    Date.now() - lastRunMs > STALE_AFTER_MINUTES * 60 * 1000;

  if (failures >= 3 || (stale && failures >= 1)) {
    return {
      level: "critical",
      label: "Critical",
      message: stale
        ? `Scheduler appears stale and has ${failures} consecutive failure(s).`
        : `Scheduler has ${failures} consecutive failures.`,
      stale,
    };
  }

  if (state.lastRunStatus === "error" || failures >= 1 || stale) {
    if (stale && lastRunMs === null) {
      return {
        level: "warning",
        label: "Warning",
        message: `Automation is in ${state.mode} mode but no scheduler run has been recorded yet.`,
        stale: true,
      };
    }
    return {
      level: "warning",
      label: "Warning",
      message: stale
        ? `No run in the last ${STALE_AFTER_MINUTES} minutes.`
        : "Latest scheduler run reported an error.",
      stale,
    };
  }

  return {
    level: "healthy",
    label: "Healthy",
    message: "Latest scheduler run succeeded and health is stable.",
    stale: false,
  };
}

// ─── Transfer window ──────────────────────────────────────────────────────────

export type TransferWindowState = {
  enabled: boolean;
  startsAtIso: string;
  endsAtIso: string;
  updatedBy?: string;
  updatedAt?: string;
};

export const DEFAULT_TRANSFER_WINDOW: TransferWindowState = {
  enabled: false,
  startsAtIso: "",
  endsAtIso: "",
};

// ─── Live simulator ───────────────────────────────────────────────────────────

export type LiveSimulatorState = {
  nextWave: number;
  totalWaves: number;
  lastAppliedWave?: number | null;
  lastLabel?: string | null;
  done: boolean;
  updatedAt?: string;
  updatedBy?: string;
};

export type LiveSimulatorResult = {
  waveIndex?: number;
  label?: string;
  totalWaves?: number;
  nextWave?: number;
  done?: boolean;
  matches?: number;
  updated?: number;
  quarantined?: number;
};

export type PublicRehearsalResetPreview = {
  willDeleteMatches?: number;
  willDeleteTransferEvents?: number;
  willResetUsers?: number;
  willResetTeams?: number;
  willDeleteLeaderboard?: boolean;
};

export type PublicRehearsalResetResult = {
  deletedMatches?: number;
  deletedTransferEvents?: number;
  resetUsers?: number;
  resetTeams?: number;
  deletedLeaderboard?: boolean;
};

// ─── Fixture ingest ───────────────────────────────────────────────────────────

export type FixtureSelectionPayload = {
  maxMatches?: number;
  cutoffIso?: string;
};

export type FixtureIngestPayload = FixtureSelectionPayload & {
  dryRun?: boolean;
};

export type IngestResult = {
  matches?: number;
  updated?: number;
  quarantined?: number;
  provider?: string;
  target?: string;
  leaderboardTarget?: string;
};

export type ResetPreviewResult = {
  willDelete?: number;
  willIngest?: number;
};

export type ResetResult = {
  deletedFixtureMatches?: number;
  matches?: number;
  updated?: number;
};

export function buildFixturePayload(maxStr: string, cutoffStr: string) {
  const max = Number(maxStr);
  const hasMax = Number.isFinite(max) && max > 0;
  const trimmedCutoff = cutoffStr.trim();
  const hasCutoff = trimmedCutoff.length > 0;
  const payload: FixtureSelectionPayload = {};
  if (hasMax) payload.maxMatches = Math.floor(max);
  if (hasCutoff) payload.cutoffIso = trimmedCutoff;
  return { max, hasMax, hasCutoff, trimmedCutoff, payload };
}

// ─── Leaderboard / recompute (used by Bundle 2.2) ────────────────────────────

export type LeaderboardRowStatus = {
  userId: string;
  displayName: string;
  totalScore: number;
  rank: number;
};

export type LeaderboardStatus = {
  lastUpdated?: string;
  scoringVersion?: string;
  includeLive?: boolean;
  rows?: LeaderboardRowStatus[];
};

export type ShadowLeaderboardStatus = {
  lastUpdated?: string;
  lastAttemptAt?: string;
  scoringVersion?: string;
  includeLive?: boolean;
  rows?: LeaderboardRowStatus[];
  updatedBy?: string;
  rowCount?: number;
  sourceCollection?: string;
  target?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
};

export type IngestHealthState = {
  lastIngestAttemptAt?: string;
  lastIngestSuccessAt?: string;
  lastIngestErrorAt?: string;
  lastIngestErrorMessage?: string;
  lastRecomputeAttemptAt?: string;
  lastRecomputeSuccessAt?: string;
  lastRecomputeErrorAt?: string;
  lastRecomputeErrorMessage?: string;
  scoresDirty: boolean;
  dirtyReason?: string | null;
  activeProvider?: string;
  mode?: string | null;
};

export type FixtureReplayState = {
  cursor: number;
  waveSize?: number | null;
  total?: number | null;
  done: boolean;
  shadowMatchCount: number;
};

export type RecomputeResult = {
  users?: number;
  matches?: number;
  wasDirty?: boolean;
  dirtyReason?: string | null;
  retried?: boolean;
  target?: string;
};

export type ReplayResult = {
  applied?: number;
  matches?: number;
  quarantined?: number;
  cursor?: number;
  nextCursor?: number;
  total?: number;
  done?: boolean;
  deleted?: number;
};

export function readLeaderboardRows(
  data: Record<string, unknown>
): LeaderboardRowStatus[] {
  const rawRows = Array.isArray(data.rows) ? data.rows : [];
  return rawRows
    .map((row: unknown): LeaderboardRowStatus | null => {
      if (!isRecord(row)) return null;
      const userId =
        typeof row.userId === "string" && row.userId.trim().length > 0
          ? row.userId
          : null;
      const displayName =
        typeof row.displayName === "string" && row.displayName.trim().length > 0
          ? row.displayName
          : null;
      const totalScore =
        typeof row.totalScore === "number" && Number.isFinite(row.totalScore)
          ? row.totalScore
          : null;
      const rank =
        typeof row.rank === "number" && Number.isFinite(row.rank)
          ? Math.max(0, Math.floor(row.rank))
          : null;
      if (!userId || !displayName || totalScore === null || rank === null) {
        return null;
      }
      return { userId, displayName, totalScore, rank };
    })
    .filter((row): row is LeaderboardRowStatus => row !== null);
}
