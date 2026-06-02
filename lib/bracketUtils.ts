export type BracketStage = { id: string; name: string };

export type BracketGoal = {
  minute: number | null;
  playerName: string | null;
  teamSide: "home" | "away";
  type: "REGULAR" | "OWN_GOAL" | "PENALTY" | "EXTRA_TIME";
};

export type BracketMatch = {
  id: string;
  t1?: string;
  t2?: string;
  /** Display label override for t1 — shown when t1 is a placeholder TBD-* ID. */
  t1Label?: string;
  /** Display label override for t2 — shown when t2 is a placeholder TBD-* ID. */
  t2Label?: string;
  s1?: number;
  s2?: number;
  status?: string;
  impact?: string;
  impactType?: "critical" | "high" | "normal";
  kickoffTime?: string;
  updatedAt?: string;
  isLive?: boolean;
  /** Group letter/code when stage is GROUP (optional; from match doc). */
  group?: string;
  /** Stage this match belongs to — populated when flattening cross-stage results. */
  stageId?: string;
  /** Card counts [home, away] */
  yellowCards?: [number, number];
  redCards?: [number, number];
  // Rich display data (Deep Data plan)
  /** Elapsed minute for live matches, e.g. 67 */
  minute?: number | null;
  /** Half-time score [home, away] */
  scoreHT?: [number, number] | null;
  /** Penalty shootout score [home, away] — only set when match was decided on pens */
  scorePens?: [number, number] | null;
  /** Resolved winner from penalty shootout */
  winner?: "HOME" | "AWAY" | null;
  /** Goal scorer events (regulation + ET only, no shootout penalties) */
  goals?: BracketGoal[];
};

export const STAGE_ORDER = ["GROUP", "R32", "R16", "QF", "SF", "FINAL"] as const;

const STAGE_LABELS: Record<string, string> = {
  GROUP: "Group Stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  FINAL: "Final",
};

export function stageLabel(stageId: string) {
  return STAGE_LABELS[stageId] ?? stageId;
}

export function matchStatusLabel(status?: string) {
  if (status === "LIVE") return "Live";
  if (status === "FINISHED") return "Final";
  return "Scheduled";
}

export function isKnownStage(stage: string): stage is (typeof STAGE_ORDER)[number] {
  return STAGE_ORDER.includes(stage as (typeof STAGE_ORDER)[number]);
}
