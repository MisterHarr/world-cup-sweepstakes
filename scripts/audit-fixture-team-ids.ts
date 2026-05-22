/**
 * Lists team ids referenced in bundled fixture JSON that are not in TEAMS_SEED.
 * 2022 replay files intentionally reference many nations absent from the 2026 roster.
 *
 * Run: npm run audit:fixture-teams
 * Strict (exit 1 if any unknown): npm run audit:fixture-teams -- --strict
 */
import * as fs from "fs";
import * as path from "path";

import { TEAMS_SEED } from "../lib/seed/teamsSeed";

const allowed = new Set(TEAMS_SEED.map((t) => t.id));

function collectTeamIds(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) collectTeamIds(v, into);
    return;
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const h = o.homeTeamId;
    const a = o.awayTeamId;
    if (typeof h === "string" && h.trim()) into.add(h.trim());
    if (typeof a === "string" && a.trim()) into.add(a.trim());
    for (const v of Object.values(o)) collectTeamIds(v, into);
  }
}

function main() {
  const strict = process.argv.includes("--strict");
  const root = process.cwd();
  const files = [
    "functions/src/fixtures/worldcup2022.json",
    "functions/src/fixtures/pretournament2022.json",
  ] as const;

  const fixtureIds = new Set<string>();
  for (const rel of files) {
    const p = path.join(root, rel);
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    collectTeamIds(raw, fixtureIds);
  }

  const unknown = [...fixtureIds].filter((id) => !allowed.has(id)).sort();
  const known = [...fixtureIds].filter((id) => allowed.has(id)).length;

  console.log("audit-fixture-team-ids");
  console.log(`  Fixture files: ${files.join(", ")}`);
  console.log(`  Unique team ids in fixtures: ${fixtureIds.size}`);
  console.log(`  Present in TEAMS_SEED (2026): ${known}`);
  console.log(`  Not in TEAMS_SEED: ${unknown.length}`);

  if (unknown.length > 0) {
    const preview = unknown.slice(0, 40);
    console.log(`  Examples: ${preview.join(", ")}${unknown.length > 40 ? ", …" : ""}`);
    console.log(
      "\n  Note: 2022 replay JSON is expected to diverge from the 2026-only roster.\n" +
        "  Options: trim/replace fixture JSON for 2026, or add temporary team docs for rehearsal only."
    );
  }

  if (strict && unknown.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
