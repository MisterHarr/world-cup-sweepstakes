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
 * Draw `count` teams with a tier-balanced, group-unique spread.
 *
 * Target squad composition (star + 5 drawn) is always:
 *   1×T1 · 1×T2 · 2×T3 · 2×T4
 *
 * `starTier` tells us which tier the user's chosen star team occupies so we
 * can subtract it from the draw quota, ensuring every player ends up with
 * the same spread regardless of which team they picked as their star.
 *
 * `starGroup` ensures no drawn team shares a group with the star team or
 * with any other drawn team — every squad has teams from 6 distinct groups.
 *
 * Example: T1 star → draw 0×T1, 1×T2, 2×T3, 2×T4
 *          T3 star → draw 1×T1, 1×T2, 1×T3, 2×T4
 */
export function drawTierBalanced<T extends { id: string; tier: number; group?: string }>(
  eligibleTeams: T[], // already excludes the star team
  count = 5,
  starTier = 0, // 0 = no compensation (legacy / unknown)
  starGroup = ""  // group of the star team; drawn teams must be from different groups
): T[] {
  // Full-squad target: 1×T1, 1×T2, 2×T3, 2×T4
  const targets: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2 };

  // Subtract the star team's tier from the draw quota
  if (starTier >= 1 && starTier <= 4) {
    targets[starTier] = Math.max(0, (targets[starTier] ?? 0) - 1);
  }

  // Pick teams one at a time, tracking used groups to prevent duplicates.
  // We draw tier-by-tier (T1 → T2 → T3 → T4) to preserve tier balance.
  const usedGroups = new Set<string>(starGroup ? [starGroup] : []);
  const result: T[] = [];

  function pickFromPool(pool: T[], needed: number): T[] {
    const picked: T[] = [];
    for (const team of pool) {
      if (picked.length >= needed) break;
      const g = team.group ?? "";
      if (g && usedGroups.has(g)) continue; // skip same-group teams
      usedGroups.add(g);
      picked.push(team);
    }
    return picked;
  }

  for (const tier of [1, 2, 3, 4]) {
    const needed = targets[tier] ?? 0;
    if (needed <= 0) continue;
    const pool = shuffle(eligibleTeams.filter((t) => t.tier === tier));
    result.push(...pickFromPool(pool, needed));
  }

  if (result.length >= count) {
    return uniqueByTeamId(result).slice(0, count);
  }

  // Fallback: fill remaining slots from the full pool respecting group constraint
  // (handles edge cases where tier pools run dry due to group exclusions)
  const resultIds = new Set(result.map((t) => t.id));
  const fallbackPool = shuffle(eligibleTeams.filter((t) => !resultIds.has(t.id)));
  result.push(...pickFromPool(fallbackPool, count - result.length));

  // Final safety net: if group constraint makes it impossible (shouldn't happen
  // with 16 groups and only 6 picks), fill without group check
  if (result.length < count) {
    const resultIds2 = new Set(result.map((t) => t.id));
    const remainder = shuffle(eligibleTeams.filter((t) => !resultIds2.has(t.id)));
    result.push(...remainder.slice(0, count - result.length));
  }

  return uniqueByTeamId(result).slice(0, count);
}
