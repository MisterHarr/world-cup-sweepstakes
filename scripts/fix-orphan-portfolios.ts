/**
 * Scan all user documents and replace any portfolio/entry references to team IDs
 * that no longer exist in Firestore with randomly-chosen valid replacements.
 *
 * Safe: only rewrites docs that actually have orphan references.
 * Dry-run by default — pass --execute to write.
 *
 * Usage:
 *   npx tsx scripts/fix-orphan-portfolios.ts            # dry-run
 *   npx tsx scripts/fix-orphan-portfolios.ts --execute  # write fixes
 */
export {};

async function main() {
  const execute = process.argv.includes("--execute");

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");
  const { FieldValue } = await import("../functions/node_modules/firebase-admin/lib/firestore/index.js") as typeof import("firebase-admin/firestore");

  if (!admin.apps.length) admin.initializeApp();

  const db = admin.firestore();

  // 1. Load valid team IDs from Firestore (what's actually there now)
  const teamsSnap = await db.collection("teams").get();
  const validTeamIds = new Set(teamsSnap.docs.map((d) => d.id));
  console.log(`Valid teams in Firestore: ${validTeamIds.size}`);

  const validTeamArr = [...validTeamIds];

  function pickReplacement(exclude: Set<string>): string | null {
    const pool = validTeamArr.filter((id) => !exclude.has(id));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 2. Scan all user docs
  const usersSnap = await db.collection("users").get();
  let fixed = 0;
  let skipped = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data() as Record<string, unknown>;
    const portfolio = Array.isArray(data.portfolio) ? data.portfolio as Array<Record<string, unknown>> : [];
    const entry = typeof data.entry === "object" && data.entry !== null ? data.entry as Record<string, unknown> : null;

    // Collect currently assigned valid IDs (for exclusion during replacement)
    const currentIds = new Set(
      portfolio
        .map((p) => p.teamId as string)
        .filter((id) => typeof id === "string" && validTeamIds.has(id))
    );

    // Find orphan portfolio entries
    const orphanItems = portfolio.filter((p) => {
      const id = p.teamId as string;
      return typeof id === "string" && !validTeamIds.has(id);
    });

    if (orphanItems.length === 0) {
      skipped++;
      continue;
    }

    console.log(`\nUser ${userDoc.id} (${data.email ?? "?"}): ${orphanItems.length} orphan(s)`);
    orphanItems.forEach((p) => console.log(`  orphan teamId: ${p.teamId}`));

    // Build replacement mapping
    const replacements = new Map<string, string>();
    for (const item of orphanItems) {
      const oldId = item.teamId as string;
      const newId = pickReplacement(currentIds);
      if (!newId) {
        console.log(`  ⚠️  No valid replacement available for ${oldId} — skipping user`);
        break;
      }
      replacements.set(oldId, newId);
      currentIds.add(newId);
      console.log(`  replace ${oldId} → ${newId}`);
    }

    if (replacements.size !== orphanItems.length) continue;

    // Build new portfolio
    const newPortfolio = portfolio.map((p) => {
      const id = p.teamId as string;
      return replacements.has(id) ? { ...p, teamId: replacements.get(id) } : p;
    });

    // Build new entry.drawnTeamIds
    let newEntry = entry;
    if (entry && Array.isArray(entry.drawnTeamIds)) {
      const newDrawnIds = (entry.drawnTeamIds as string[]).map((id) =>
        replacements.has(id) ? (replacements.get(id) as string) : id
      );
      newEntry = { ...entry, drawnTeamIds: newDrawnIds };
    }

    if (execute) {
      const patch: Record<string, unknown> = {
        portfolio: newPortfolio,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (newEntry) patch.entry = newEntry;
      await userDoc.ref.update(patch);
      console.log(`  ✅ Updated`);
    } else {
      console.log(`  (dry-run — would update)`);
    }

    fixed++;
  }

  console.log(`\n${execute ? "Fixed" : "Would fix"} ${fixed} user(s). ${skipped} had no orphans.`);
  if (!execute) console.log("Re-run with --execute to apply.");
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
