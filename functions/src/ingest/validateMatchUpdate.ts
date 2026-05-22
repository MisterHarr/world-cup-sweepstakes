import type {
  MatchStage,
  MatchStatus,
  NormalizedMatchUpdate,
} from "../providers/providerTypes";

export type ValidatedMatchUpdate = Omit<
  NormalizedMatchUpdate,
  | "kickoffTime"
  | "homeYellowCards"
  | "awayYellowCards"
  | "homeRedCards"
  | "awayRedCards"
  | "stage"
> & {
  kickoffTime: string;
  stage: MatchStage;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
};

export type ValidationFailureReason =
  | "unknown_team_id"
  | "duplicate_team_id"
  | "invalid_score"
  | "invalid_card_count"
  | "invalid_kickoff_time"
  | "stale_revision"
  | "regressive_status";

export type ValidationResult =
  | { ok: true; update: ValidatedMatchUpdate }
  | {
      ok: false;
      reason: ValidationFailureReason;
      message: string;
    };

function asNumberOrNull(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function asNonNegativeInteger(value: unknown): number | null {
  const num = asNumberOrNull(value);
  if (num === null || num < 0) return null;
  return Math.floor(num);
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

function readExistingRevision(existing?: Record<string, unknown>): number {
  if (!existing) return -1;

  const providerRevision = asNonNegativeInteger(existing.providerRevision);
  if (providerRevision !== null) return providerRevision;

  const revision = asNonNegativeInteger(existing.revision);
  if (revision !== null) return revision;

  return -1;
}

function readExistingStatus(existing?: Record<string, unknown>): MatchStatus | null {
  if (!existing) return null;
  return asStatus(existing.status);
}

function buildUnknownTeamMessage(
  update: NormalizedMatchUpdate,
  knownTeamIds: Set<string>
): string {
  const missing = [update.homeTeamId, update.awayTeamId].filter(
    (teamId) => !knownTeamIds.has(teamId)
  );
  return `Unknown team id(s): ${missing.join(", ")}`;
}

export async function loadKnownTeamIds(
  db: FirebaseFirestore.Firestore
): Promise<Set<string>> {
  const snap = await db.collection("teams").get();
  const ids = new Set<string>();

  snap.docs.forEach((docSnap) => {
    ids.add(docSnap.id);
    const data = docSnap.data() as Record<string, unknown>;
    if (typeof data.id === "string" && data.id.trim().length > 0) {
      ids.add(data.id.trim());
    }
  });

  return ids;
}

export function validateMatchUpdate(params: {
  update: NormalizedMatchUpdate;
  knownTeamIds: Set<string>;
  existing?: Record<string, unknown>;
}): ValidationResult {
  const { update, knownTeamIds, existing } = params;

  if (
    !knownTeamIds.has(update.homeTeamId) ||
    !knownTeamIds.has(update.awayTeamId)
  ) {
    return {
      ok: false,
      reason: "unknown_team_id",
      message: buildUnknownTeamMessage(update, knownTeamIds),
    };
  }

  if (update.homeTeamId === update.awayTeamId) {
    return {
      ok: false,
      reason: "duplicate_team_id",
      message: "homeTeamId and awayTeamId must be different.",
    };
  }

  const kickoffTime =
    typeof update.kickoffTime === "string" &&
    update.kickoffTime.trim().length > 0 &&
    !Number.isNaN(Date.parse(update.kickoffTime))
      ? update.kickoffTime
      : null;
  if (!kickoffTime) {
    return {
      ok: false,
      reason: "invalid_kickoff_time",
      message: "kickoffTime must be a valid ISO timestamp.",
    };
  }

  const homeScore =
    update.homeScore === null ? null : asNonNegativeInteger(update.homeScore);
  const awayScore =
    update.awayScore === null ? null : asNonNegativeInteger(update.awayScore);
  if (
    (update.homeScore !== null && homeScore === null) ||
    (update.awayScore !== null && awayScore === null)
  ) {
    return {
      ok: false,
      reason: "invalid_score",
      message: "Scores must be null or non-negative numbers.",
    };
  }

  const homeYellowCards = asNonNegativeInteger(update.homeYellowCards ?? 0);
  const awayYellowCards = asNonNegativeInteger(update.awayYellowCards ?? 0);
  const homeRedCards = asNonNegativeInteger(update.homeRedCards ?? 0);
  const awayRedCards = asNonNegativeInteger(update.awayRedCards ?? 0);

  if (
    homeYellowCards === null ||
    awayYellowCards === null ||
    homeRedCards === null ||
    awayRedCards === null
  ) {
    return {
      ok: false,
      reason: "invalid_card_count",
      message: "Card counts must be non-negative numbers.",
    };
  }

  const storedRevision = readExistingRevision(existing);
  if (update.revision < storedRevision) {
    return {
      ok: false,
      reason: "stale_revision",
      message: `Incoming revision ${update.revision} is older than stored revision ${storedRevision}.`,
    };
  }

  const storedStatus = readExistingStatus(existing);
  if (
    storedStatus === "FINISHED" &&
    update.status !== "FINISHED" &&
    update.correction !== true
  ) {
    return {
      ok: false,
      reason: "regressive_status",
      message: "Finished match cannot regress without an explicit correction flag.",
    };
  }

  const stage = asStage(update.stage) ?? "GROUP";

  return {
    ok: true,
    update: {
      ...update,
      kickoffTime,
      stage,
      homeScore,
      awayScore,
      homeYellowCards,
      awayYellowCards,
      homeRedCards,
      awayRedCards,
    },
  };
}
