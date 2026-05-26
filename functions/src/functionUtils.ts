export type TeamSeedRow = {
  id: string;
  name: string;
  group: string;
  tier: number;
  flagUrl: string;
};

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uniqueByTeamId<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  rows.forEach((row) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    unique.push(row);
  });
  return unique;
}

/**
 * Draw `count` teams with a tier-balanced spread.
 *
 * Target squad composition (star + 5 drawn) is always:
 *   1×T1 · 1×T2 · 2×T3 · 2×T4
 *
 * `starTier` tells us which tier the user's chosen star team occupies so we
 * can subtract it from the draw quota, ensuring every player ends up with
 * the same spread regardless of which team they picked as their star.
 *
 * Example: T1 star → draw 0×T1, 1×T2, 2×T3, 2×T4
 *          T3 star → draw 1×T1, 1×T2, 1×T3, 2×T4
 */
export function drawTierBalanced<T extends { id: string; tier: number }>(
  eligibleTeams: T[], // already excludes the star team
  count = 5,
  starTier = 0 // 0 = no compensation (legacy / unknown)
): T[] {
  // Full-squad target: 1×T1, 1×T2, 2×T3, 2×T4
  const targets: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2 };

  // Subtract the star team's tier from the draw quota
  if (starTier >= 1 && starTier <= 4) {
    targets[starTier] = Math.max(0, (targets[starTier] ?? 0) - 1);
  }

  const byTier: Record<number, T[]> = {
    1: shuffle(eligibleTeams.filter((t) => t.tier === 1)),
    2: shuffle(eligibleTeams.filter((t) => t.tier === 2)),
    3: shuffle(eligibleTeams.filter((t) => t.tier === 3)),
    4: shuffle(eligibleTeams.filter((t) => t.tier === 4)),
  };

  const seeded = uniqueByTeamId([
    ...(byTier[1] ?? []).slice(0, targets[1] ?? 0),
    ...(byTier[2] ?? []).slice(0, targets[2] ?? 0),
    ...(byTier[3] ?? []).slice(0, targets[3] ?? 0),
    ...(byTier[4] ?? []).slice(0, targets[4] ?? 0),
  ]);

  if (seeded.length >= count) {
    return seeded.slice(0, count);
  }

  // Fallback: fill any remaining slots from the full pool (handles edge cases
  // where a tier doesn't have enough teams to satisfy the quota)
  const seededIds = new Set(seeded.map((t) => t.id));
  const pool = shuffle(eligibleTeams.filter((t) => !seededIds.has(t.id)));
  return uniqueByTeamId([...seeded, ...pool]).slice(0, count);
}
