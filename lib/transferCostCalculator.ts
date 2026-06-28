/**
 * Transfer Cost Calculator
 *
 * Calculates variable transfer costs based on team tier upgrades/downgrades.
 *
 * Strategy:
 * - Upgrading to higher tier (lower number): EXPENSIVE (penalize)
 * - Downgrading to lower tier (higher number): CHEAP (reward strategic moves)
 * - Lateral move (same tier): BASELINE cost
 *
 * Tier scale: 1 (elite) → 4 (underdog) — only 4 tiers exist in this game.
 */

export interface TransferCostCalculation {
  totalCost: number;
  baseCost: number;
  tierPenalty: number;
  tierDifference: number;
  dropTier: number;
  pickupTier: number;
  transferType: 'upgrade' | 'downgrade' | 'lateral';
}

// Lowered on 2026-06-28 alongside forward-only scoring — the penalty no
// longer compensates for retroactive points snipes, so it's smaller.
const BASE_COST = 2;           // Flat fee for any transfer
const UPGRADE_MULTIPLIER = 3;  // Per tier step when upgrading
const FLAT_DOWNGRADE_COST = 1; // Flat cost when moving to a lower tier
const MINIMUM_COST = 1;        // Floor

/**
 * Calculate the cost of a transfer based on team tiers
 *
 * @param dropTier - Tier of team being dropped (1-5)
 * @param pickupTier - Tier of team being picked up (1-5)
 * @returns Detailed cost breakdown
 */
export function calculateTransferCost(
  dropTier: number,
  pickupTier: number
): TransferCostCalculation {
  // Normalize tiers to valid range (1-4)
  const normalizedDropTier = Math.max(1, Math.min(4, Math.floor(dropTier)));
  const normalizedPickupTier = Math.max(1, Math.min(4, Math.floor(pickupTier)));

  // Calculate tier difference
  // Negative = upgrading (picking better tier)
  // Positive = downgrading (picking worse tier)
  // Zero = lateral (same tier)
  const tierDifference = normalizedPickupTier - normalizedDropTier;

  let tierPenalty = 0;
  let transferType: 'upgrade' | 'downgrade' | 'lateral';

  if (tierDifference < 0) {
    // UPGRADING: base + per-tier penalty
    transferType = 'upgrade';
    tierPenalty = Math.abs(tierDifference) * UPGRADE_MULTIPLIER;
  } else if (tierDifference > 0) {
    // DOWNGRADING: flat cost regardless of tiers dropped
    transferType = 'downgrade';
    tierPenalty = 0;
  } else {
    // LATERAL: same tier
    transferType = 'lateral';
    tierPenalty = 0;
  }

  const totalCost = transferType === 'downgrade'
    ? FLAT_DOWNGRADE_COST
    : Math.max(MINIMUM_COST, BASE_COST + tierPenalty);

  return {
    totalCost,
    baseCost: BASE_COST,
    tierPenalty,
    tierDifference,
    dropTier: normalizedDropTier,
    pickupTier: normalizedPickupTier,
    transferType,
  };
}

/**
 * Format transfer cost for display to users
 */
export function formatTransferCostBreakdown(calc: TransferCostCalculation): string {
  const { totalCost, baseCost, tierPenalty, transferType } = calc;

  if (transferType === 'lateral') {
    return `${totalCost} points (base cost)`;
  }

  const sign = tierPenalty > 0 ? '+' : '';
  return `${totalCost} points (${baseCost} base ${sign}${tierPenalty} tier ${transferType})`;
}

/**
 * Get user-friendly explanation of why this transfer costs what it does
 */
export function getTransferCostExplanation(calc: TransferCostCalculation): string {
  const { transferType, dropTier, pickupTier, tierDifference } = calc;

  if (transferType === 'upgrade') {
    return `Upgrading from Tier ${dropTier} to Tier ${pickupTier} incurs a penalty (${Math.abs(tierDifference)} tier${Math.abs(tierDifference) > 1 ? 's' : ''} better).`;
  } else if (transferType === 'downgrade') {
    return `Downgrading from Tier ${dropTier} to Tier ${pickupTier} costs less (${tierDifference} tier${tierDifference > 1 ? 's' : ''} worse).`;
  } else {
    return `Lateral move within Tier ${dropTier} (no tier penalty).`;
  }
}

/**
 * Example usage and test scenarios
 */
export const TRANSFER_COST_EXAMPLES = [
  { drop: 4, pickup: 1, description: 'Tier 4 → Tier 1 (maximum upgrade, 15 pts)' },
  { drop: 3, pickup: 1, description: 'Tier 3 → Tier 1 (moderate upgrade, 11 pts)' },
  { drop: 2, pickup: 1, description: 'Tier 2 → Tier 1 (one-step upgrade, 7 pts)' },
  { drop: 2, pickup: 2, description: 'Tier 2 → Tier 2 (lateral, 3 pts)' },
  { drop: 1, pickup: 3, description: 'Tier 1 → Tier 3 (downgrade, 2 pts)' },
  { drop: 1, pickup: 4, description: 'Tier 1 → Tier 4 (maximum downgrade, 2 pts)' },
];
