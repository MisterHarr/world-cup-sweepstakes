import { BADGES } from "../lib/badgeDefinitions";

const FEASIBLE_CRITERIA_TYPES = new Set<string>([
  "final_rank",
  "total_score",
  "rank_score_combo",
  "rank_with_penalty_cap",
  "portfolio_diversity",
  "portfolio_composition_rank",
  "portfolio_composition",
  "portfolio_balance",
  "portfolio_floor",
  "featured_team_score",
  "featured_team_wins",
  "featured_share",
  "transfer_count",
  "squad_completion",
  "transfer_risk_reward",
  "upgrade_and_rank",
  "signup_timing",
]);

const INFEASIBLE_CRITERIA_TYPES = new Set<string>([
  "matchday_rank",
  "rank_change",
  "rank_consistency",
  "matchday_perfect",
  "player_achievement",
  "team_progression",
  "featured_team_progression",
  "featured_team_group",
  "featured_team_wins_tournament",
  "login_streak",
  "squad_views",
  "transfer_timing",
]);

const issues: string[] = [];

for (const badge of BADGES) {
  const criteriaType = badge.unlockCriteria?.type;
  if (typeof criteriaType !== "string" || criteriaType.trim().length === 0) {
    issues.push(`${badge.id}: missing unlockCriteria.type`);
    continue;
  }

  if (INFEASIBLE_CRITERIA_TYPES.has(criteriaType)) {
    issues.push(`${badge.id}: uses infeasible criteria type "${criteriaType}"`);
    continue;
  }

  if (!FEASIBLE_CRITERIA_TYPES.has(criteriaType)) {
    issues.push(`${badge.id}: unknown criteria type "${criteriaType}"`);
  }
}

if (issues.length > 0) {
  console.error("FAIL: badge feasibility audit found issues:");
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

const byType = BADGES.reduce<Record<string, number>>((acc, badge) => {
  const criteriaType = badge.unlockCriteria?.type ?? "unknown";
  acc[criteriaType] = (acc[criteriaType] ?? 0) + 1;
  return acc;
}, {});

console.log(
  `PASS: badge feasibility audit validated ${BADGES.length} badges across ${Object.keys(byType).length} criteria types.`
);
