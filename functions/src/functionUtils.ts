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

export function drawTierBalanced<T extends { id: string; tier: number }>(
  eligibleTeams: T[],
  count = 5
): T[] {
  const tier1 = eligibleTeams.filter((team) => team.tier === 1);
  const tier2 = eligibleTeams.filter((team) => team.tier === 2);
  const tier3 = eligibleTeams.filter((team) => team.tier === 3);
  const tier4 = eligibleTeams.filter((team) => team.tier === 4);

  const seeded = uniqueByTeamId([
    ...shuffle(tier1).slice(0, 1),
    ...shuffle(tier2).slice(0, 1),
    ...shuffle(tier3).slice(0, 2),
    ...shuffle(tier4).slice(0, 1),
  ]);

  if (seeded.length >= count) {
    return seeded.slice(0, count);
  }

  const seededIds = new Set(seeded.map((team) => team.id));
  const remainingPool = eligibleTeams.filter((team) => !seededIds.has(team.id));
  const filled = seeded.concat(shuffle(remainingPool).slice(0, count - seeded.length));
  return uniqueByTeamId(filled).slice(0, count);
}
