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
 * Tier scale: 1 (elite) → 5 (underdog)
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

const BASE_COST = 10;
const UPGRADE_MULTIPLIER = 15; // Cost per tier when upgrading
const DOWNGRADE_DISCOUNT = 3; // Discount per tier when downgrading
const MINIMUM_COST = 5; // Floor for any transfer

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
  // Normalize tiers to valid range (1-5)
  const normalizedDropTier = Math.max(1, Math.min(5, Math.floor(dropTier)));
  const normalizedPickupTier = Math.max(1, Math.min(5, Math.floor(pickupTier)));

  // Calculate tier difference
  // Negative = upgrading (picking better tier)
  // Positive = downgrading (picking worse tier)
  // Zero = lateral (same tier)
  const tierDifference = normalizedPickupTier - normalizedDropTier;

  let tierPenalty = 0;
  let transferType: 'upgrade' | 'downgrade' | 'lateral';

  if (tierDifference < 0) {
    // UPGRADING: Picking a better team (lower tier number)
    // Example: Tier 4 → Tier 1 (difference = -3)
    transferType = 'upgrade';
    tierPenalty = Math.abs(tierDifference) * UPGRADE_MULTIPLIER;
  } else if (tierDifference > 0) {
    // DOWNGRADING: Picking a worse team (higher tier number)
    // Example: Tier 1 → Tier 4 (difference = +3)
    transferType = 'downgrade';
    tierPenalty = -(tierDifference * DOWNGRADE_DISCOUNT);
  } else {
    // LATERAL: Same tier
    transferType = 'lateral';
    tierPenalty = 0;
  }

  // Calculate total cost with minimum floor
  const totalCost = Math.max(MINIMUM_COST, BASE_COST + tierPenalty);

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
  { drop: 5, pickup: 1, description: 'Tier 5 → Tier 1 (maximum upgrade)' },
  { drop: 4, pickup: 1, description: 'Tier 4 → Tier 1 (expensive upgrade)' },
  { drop: 3, pickup: 1, description: 'Tier 3 → Tier 1 (moderate upgrade)' },
  { drop: 2, pickup: 2, description: 'Tier 2 → Tier 2 (lateral)' },
  { drop: 1, pickup: 3, description: 'Tier 1 → Tier 3 (cheap downgrade)' },
  { drop: 1, pickup: 5, description: 'Tier 1 → Tier 5 (maximum downgrade)' },
];
