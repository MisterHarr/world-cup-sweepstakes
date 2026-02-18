export type BracketStage = { id: string; name: string };

export type BracketMatch = {
  id: string;
  t1?: string;
  t2?: string;
  s1?: number;
  s2?: number;
  status?: string;
  impact?: string;
  impactType?: "critical" | "high" | "normal";
  kickoffTime?: string;
  updatedAt?: string;
  isLive?: boolean;
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
