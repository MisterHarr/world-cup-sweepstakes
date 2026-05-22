/**
 * Delete Firestore team documents whose IDs are not in TEAMS_SEED.
 * Dry-run by default — pass --execute to actually delete.
 *
 * Usage:
 *   npx tsx scripts/purge-orphan-teams.ts            # dry-run (safe)
 *   npx tsx scripts/purge-orphan-teams.ts --execute  # delete for real
 *
 * Requires Application Default Credentials.
 */
export {};

async function main() {
  const execute = process.argv.includes("--execute");

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const { TEAMS_SEED } = await import("../lib/seed/teamsSeed.js");
  const allowedIds = new Set(TEAMS_SEED.map((t) => t.id));

  const db = admin.firestore();
  const snap = await db.collection("teams").get();

  const orphans = snap.docs.filter((d) => !allowedIds.has(d.id));

  if (orphans.length === 0) {
    console.log("✅ No orphan team docs found.");
    return;
  }

  console.log(`Found ${orphans.length} orphan team doc(s):`);
  orphans.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    console.log(`  ${d.id}  name="${data.name ?? "—"}"`);
  });

  if (!execute) {
    console.log("\nDry-run complete. Re-run with --execute to delete.");
    return;
  }

  const batch = db.batch();
  orphans.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  console.log(`\n✅ Deleted ${orphans.length} orphan team doc(s).`);
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
