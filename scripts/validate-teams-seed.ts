/**
 * Structural validation for lib/seed/teamsSeed.ts (TEAMS_SEED).
 * Run: npm run validate:teams-seed
 */
import { TEAMS_SEED } from "../lib/seed/teamsSeed";

const GROUPS = "ABCDEFGHIJKL".split("");

function main() {
  const errors: string[] = [];

  if (TEAMS_SEED.length !== 48) {
    errors.push(`Expected 48 teams, got ${TEAMS_SEED.length}.`);
  }

  const ids = TEAMS_SEED.map((t) => t.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || id.trim() === "") {
      errors.push("Empty team id.");
    }
    if (seen.has(id)) {
      errors.push(`Duplicate team id: ${id}`);
    }
    seen.add(id);
  }

  const byGroup = new Map<string, number>();
  for (const g of GROUPS) byGroup.set(g, 0);

  for (const team of TEAMS_SEED) {
    const g = team.group;
    if (!byGroup.has(g)) {
      errors.push(`Invalid group "${g}" for team ${team.id}.`);
    } else {
      byGroup.set(g, (byGroup.get(g) ?? 0) + 1);
    }
    if (!team.name?.trim()) {
      errors.push(`Team ${team.id}: missing name.`);
    }
    if (![1, 2, 3, 4].includes(team.tier)) {
      errors.push(`Team ${team.id}: tier must be 1–4, got ${team.tier}.`);
    }
  }

  for (const g of GROUPS) {
    const n = byGroup.get(g) ?? 0;
    if (n !== 4) {
      errors.push(`Group ${g}: expected 4 teams, got ${n}.`);
    }
  }

  if (errors.length > 0) {
    console.error("validate-teams-seed: FAILED\n");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("validate-teams-seed: OK (48 teams, 12 groups × 4, unique ids, tiers 1–4).");
}

main();
