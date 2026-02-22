/**
 * Badge Definitions for World Cup Sweepstakes
 *
 * Defines all 30 badges with unlock criteria, metadata, and point rewards.
 * Based on competitive research from FPL, fantasy sports gamification.
 *
 * @see docs/BADGE-SYSTEM-DESIGN.md for full design documentation
 */

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";
export type BadgeCategory = "performance" | "portfolio" | "prediction" | "engagement" | "fun";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji
  category: BadgeCategory;
  rarity: BadgeRarity;
  pointsAwarded: number;
  unlockCriteria: {
    type: string;
    condition: Record<string, unknown>;
  };
  version: string;
}

/**
 * All badge definitions (30 total)
 */
export const BADGES: Badge[] = [
  // ===== PERFORMANCE BADGES (8) =====
  {
    id: "perf_champion",
    name: "Champion",
    description: "Finish #1 overall in the tournament",
    icon: "🏆",
    category: "performance",
    rarity: "legendary",
    pointsAwarded: 100,
    unlockCriteria: {
      type: "final_rank",
      condition: { rank: 1 },
    },
    version: "v1",
  },
  {
    id: "perf_podium",
    name: "Podium Finisher",
    description: "Finish in the top 3",
    icon: "🥇",
    category: "performance",
    rarity: "epic",
    pointsAwarded: 50,
    unlockCriteria: {
      type: "final_rank",
      condition: { rankMax: 3 },
    },
    version: "v1",
  },
  {
    id: "perf_top10",
    name: "Elite Ten",
    description: "Finish in the top 10",
    icon: "💎",
    category: "performance",
    rarity: "rare",
    pointsAwarded: 25,
    unlockCriteria: {
      type: "final_rank",
      condition: { rankMax: 10 },
    },
    version: "v1",
  },
  {
    id: "perf_weekly_winner",
    name: "Fast Starter",
    description: "Reach 25+ total points during the tournament",
    icon: "⚡",
    category: "performance",
    rarity: "rare",
    pointsAwarded: 20,
    unlockCriteria: {
      type: "total_score",
      condition: { minScore: 25 },
    },
    version: "v1",
  },
  {
    id: "perf_comeback",
    name: "Late Surge",
    description: "Finish top 5 with 45+ points",
    icon: "📈",
    category: "performance",
    rarity: "rare",
    pointsAwarded: 15,
    unlockCriteria: {
      type: "rank_score_combo",
      condition: { rankMax: 5, minScore: 45 },
    },
    version: "v1",
  },
  {
    id: "perf_consistent",
    name: "Steady Climber",
    description: "Finish in top 10 with zero transfer penalties",
    icon: "👑",
    category: "performance",
    rarity: "epic",
    pointsAwarded: 30,
    unlockCriteria: {
      type: "rank_with_penalty_cap",
      condition: { rankMax: 10, maxPenaltyPoints: 0 },
    },
    version: "v1",
  },
  {
    id: "perf_century",
    name: "Century Club",
    description: "Score 100+ total points",
    icon: "💯",
    category: "performance",
    rarity: "common",
    pointsAwarded: 10,
    unlockCriteria: {
      type: "total_score",
      condition: { minScore: 100 },
    },
    version: "v1",
  },
  {
    id: "perf_perfect_week",
    name: "Perfect Six",
    description: "All six teams in your squad score at least 5 points",
    icon: "✨",
    category: "performance",
    rarity: "legendary",
    pointsAwarded: 50,
    unlockCriteria: {
      type: "portfolio_balance",
      condition: { minPointsPerTeam: 5 },
    },
    version: "v1",
  },

  // ===== PORTFOLIO BADGES (7) =====
  {
    id: "port_tier_master",
    name: "Tier Master",
    description: "Have teams from all 4 tracked tiers in your portfolio",
    icon: "🎯",
    category: "portfolio",
    rarity: "rare",
    pointsAwarded: 15,
    unlockCriteria: {
      type: "portfolio_diversity",
      condition: { allTiers: [1, 2, 3, 4] },
    },
    version: "v1",
  },
  {
    id: "port_underdog",
    name: "Underdog Champion",
    description: "Finish top 10 with majority Tier 3-4 teams",
    icon: "🐕",
    category: "portfolio",
    rarity: "epic",
    pointsAwarded: 40,
    unlockCriteria: {
      type: "portfolio_composition_rank",
      condition: { majorityTiers: [3, 4], rankMax: 10 },
    },
    version: "v1",
  },
  {
    id: "port_elite_squad",
    name: "Elite Squad",
    description: "All teams are Tier 1-2",
    icon: "💎",
    category: "portfolio",
    rarity: "rare",
    pointsAwarded: 20,
    unlockCriteria: {
      type: "portfolio_composition",
      condition: { onlyTiers: [1, 2] },
    },
    version: "v1",
  },
  {
    id: "port_no_transfers",
    name: "Transfer Virgin",
    description: "Complete tournament without using any transfers",
    icon: "🚫",
    category: "portfolio",
    rarity: "epic",
    pointsAwarded: 35,
    unlockCriteria: {
      type: "transfer_count",
      condition: { maxTransfers: 0, tournamentEnd: true },
    },
    version: "v1",
  },
  {
    id: "port_transfer_addict",
    name: "Transfer Addict",
    description: "Use all your transfers",
    icon: "🔄",
    category: "portfolio",
    rarity: "common",
    pointsAwarded: 5,
    unlockCriteria: {
      type: "transfer_count",
      condition: { usedAll: true },
    },
    version: "v1",
  },
  {
    id: "port_featured_glory",
    name: "Featured Glory",
    description: "Featured team scores 30+ points",
    icon: "⭐",
    category: "portfolio",
    rarity: "rare",
    pointsAwarded: 15,
    unlockCriteria: {
      type: "featured_team_score",
      condition: { minPoints: 30 },
    },
    version: "v1",
  },
  {
    id: "port_balanced",
    name: "Balanced Portfolio",
    description: "Each team scores at least 10 points",
    icon: "⚖️",
    category: "portfolio",
    rarity: "rare",
    pointsAwarded: 20,
    unlockCriteria: {
      type: "portfolio_balance",
      condition: { minPointsPerTeam: 10 },
    },
    version: "v1",
  },

  // ===== PREDICTION BADGES (6) =====
  {
    id: "pred_golden_boot",
    name: "Goal Magnet",
    description: "Your featured team scores 18+ points",
    icon: "🥾",
    category: "prediction",
    rarity: "legendary",
    pointsAwarded: 100,
    unlockCriteria: {
      type: "featured_team_score",
      condition: { minPoints: 18 },
    },
    version: "v1",
  },
  {
    id: "pred_final_four",
    name: "All-In Form",
    description: "Every team in your squad scores at least 6 points",
    icon: "🏆",
    category: "prediction",
    rarity: "legendary",
    pointsAwarded: 75,
    unlockCriteria: {
      type: "portfolio_balance",
      condition: { minPointsPerTeam: 6 },
    },
    version: "v1",
  },
  {
    id: "pred_dark_horse",
    name: "Dark Horse",
    description: "Your Tier 3-4 featured team scores 14+ points",
    icon: "🐴",
    category: "prediction",
    rarity: "epic",
    pointsAwarded: 50,
    unlockCriteria: {
      type: "featured_team_score",
      condition: { minPoints: 14, featuredTier: [3, 4] },
    },
    version: "v1",
  },
  {
    id: "pred_knockout_king",
    name: "No Dead Weight",
    description: "No team in your squad finishes with negative points",
    icon: "👑",
    category: "prediction",
    rarity: "rare",
    pointsAwarded: 25,
    unlockCriteria: {
      type: "portfolio_floor",
      condition: { minPointsPerTeam: 0 },
    },
    version: "v1",
  },
  {
    id: "pred_champions_pick",
    name: "Captain Carry",
    description: "Featured team contributes at least 40% of your squad points",
    icon: "🥇",
    category: "prediction",
    rarity: "legendary",
    pointsAwarded: 150,
    unlockCriteria: {
      type: "featured_share",
      condition: { minShare: 0.4 },
    },
    version: "v1",
  },
  {
    id: "pred_group_winner",
    name: "Group Grinder",
    description: "Your featured team records 2+ wins",
    icon: "📊",
    category: "prediction",
    rarity: "common",
    pointsAwarded: 10,
    unlockCriteria: {
      type: "featured_team_wins",
      condition: { minWins: 2 },
    },
    version: "v1",
  },

  // ===== ENGAGEMENT BADGES (5) =====
  {
    id: "engage_early_bird",
    name: "Early Bird",
    description: "Complete signup before tournament starts",
    icon: "🐦",
    category: "engagement",
    rarity: "common",
    pointsAwarded: 5,
    unlockCriteria: {
      type: "signup_timing",
      condition: { beforeTournament: true },
    },
    version: "v1",
  },
  {
    id: "engage_daily_visitor",
    name: "Measured Manager",
    description: "Use at most 2 transfers and keep one in reserve",
    icon: "📅",
    category: "engagement",
    rarity: "rare",
    pointsAwarded: 20,
    unlockCriteria: {
      type: "transfer_count",
      condition: { usedAtMost: 2 },
    },
    version: "v1",
  },
  {
    id: "engage_social",
    name: "Squad Builder",
    description: "Complete full squad setup (1 featured + 5 drawn)",
    icon: "🦋",
    category: "engagement",
    rarity: "common",
    pointsAwarded: 10,
    unlockCriteria: {
      type: "squad_completion",
      condition: { requiredTeams: 6 },
    },
    version: "v1",
  },
  {
    id: "engage_first_transfer",
    name: "First Transfer",
    description: "Execute your first transfer",
    icon: "🔄",
    category: "engagement",
    rarity: "common",
    pointsAwarded: 5,
    unlockCriteria: {
      type: "transfer_count",
      condition: { minTransfers: 1 },
    },
    version: "v1",
  },
  {
    id: "engage_squad_stalker",
    name: "Transfer Planner",
    description: "Use exactly 2 transfers",
    icon: "👀",
    category: "engagement",
    rarity: "rare",
    pointsAwarded: 15,
    unlockCriteria: {
      type: "transfer_count",
      condition: { usedExactly: 2 },
    },
    version: "v1",
  },

  // ===== FUN/SILLY BADGES (4) =====
  {
    id: "fun_chaos_agent",
    name: "Chaos Agent",
    description: "Use all transfers and still finish with a positive score",
    icon: "🎲",
    category: "fun",
    rarity: "rare",
    pointsAwarded: 10,
    unlockCriteria: {
      type: "transfer_risk_reward",
      condition: { usedAll: true, minScore: 1 },
    },
    version: "v1",
  },
  {
    id: "fun_risk_taker",
    name: "Risk Taker",
    description: "Make at least 2 tier-upgrade transfers and finish top 15",
    icon: "🎰",
    category: "fun",
    rarity: "common",
    pointsAwarded: 5,
    unlockCriteria: {
      type: "upgrade_and_rank",
      condition: { minUpgrades: 2, rankMax: 15 },
    },
    version: "v1",
  },
  {
    id: "fun_unlucky",
    name: "Unlucky Thirteen",
    description: "Finish in exactly 13th place",
    icon: "🔮",
    category: "fun",
    rarity: "rare",
    pointsAwarded: 10,
    unlockCriteria: {
      type: "final_rank",
      condition: { rank: 13 },
    },
    version: "v1",
  },
  {
    id: "fun_nearly_perfect",
    name: "So Close!",
    description: "Finish in 2nd place",
    icon: "😅",
    category: "fun",
    rarity: "epic",
    pointsAwarded: 25,
    unlockCriteria: {
      type: "final_rank",
      condition: { rank: 2 },
    },
    version: "v1",
  },
];

/**
 * Get badge by ID
 */
export function getBadgeById(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

/**
 * Get badges by category
 */
export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return BADGES.filter((b) => b.category === category);
}

/**
 * Get badges by rarity
 */
export function getBadgesByRarity(rarity: BadgeRarity): Badge[] {
  return BADGES.filter((b) => b.rarity === rarity);
}

/**
 * Get rarity color for UI
 */
export function getRarityColor(rarity: BadgeRarity): string {
  const colors = {
    common: "text-gray-400",
    rare: "text-blue-400",
    epic: "text-purple-400",
    legendary: "text-yellow-400",
  };
  return colors[rarity];
}

/**
 * Get rarity background glow for UI
 */
export function getRarityGlow(rarity: BadgeRarity): string {
  const glows = {
    common: "shadow-gray-500/20",
    rare: "shadow-blue-500/40",
    epic: "shadow-purple-500/60",
    legendary: "shadow-yellow-500/80",
  };
  return glows[rarity];
}

/**
 * Stats - Total badges by category
 */
export const BADGE_STATS = {
  total: BADGES.length,
  byCategory: {
    performance: BADGES.filter((b) => b.category === "performance").length,
    portfolio: BADGES.filter((b) => b.category === "portfolio").length,
    prediction: BADGES.filter((b) => b.category === "prediction").length,
    engagement: BADGES.filter((b) => b.category === "engagement").length,
    fun: BADGES.filter((b) => b.category === "fun").length,
  },
  byRarity: {
    common: BADGES.filter((b) => b.rarity === "common").length,
    rare: BADGES.filter((b) => b.rarity === "rare").length,
    epic: BADGES.filter((b) => b.rarity === "epic").length,
    legendary: BADGES.filter((b) => b.rarity === "legendary").length,
  },
};
