/**
 * delete-old-matches.ts
 * ─────────────────────
 * Deletes match documents from Firestore whose kickoffTime is before 2026
 * (i.e. WC 2022 / historical data that got ingested by mistake).
 *
 * Usage:
 *   npx tsx scripts/delete-old-matches.ts           # preview — shows what would be deleted
 *   npx tsx scripts/delete-old-matches.ts --confirm # actually deletes
 */
export {};

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");

  // Target live Firebase project
  process.env.FIREBASE_PROJECT ??= "worldcup-sweepstake-2026";
  // Do NOT set FIRESTORE_EMULATOR_HOST — connect to real Firestore

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = adminModule.default ?? adminModule;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT });
  }

  const db = admin.firestore();
  const cutoff = "2026-01-01T00:00:00.000Z";

  const snap = await db
    .collection("matches")
    .where("kickoffTime", "<", cutoff)
    .get();

  if (snap.empty) {
    console.log("✅ No pre-2026 match documents found — nothing to delete.");
    await admin.app().delete();
    return;
  }

  console.log(`\nFound ${snap.size} match documents with kickoffTime before 2026:\n`);
  snap.forEach((doc) => {
    const d = doc.data();
    console.log(`  ${doc.id}  ${d.kickoffTime}  ${d.homeTeamId ?? "?"} vs ${d.awayTeamId ?? "?"}  [${d.source ?? "unknown"}]`);
  });

  if (!confirm) {
    console.log(`\n⚠️  Dry run — nothing deleted. Run with --confirm to delete.\n`);
    await admin.app().delete();
    return;
  }

  console.log(`\n🗑  Deleting ${snap.size} documents...`);
  const batchSize = 400;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    docs.slice(i, i + batchSize).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`  Deleted ${Math.min(i + batchSize, docs.length)}/${docs.length}`);
  }

  console.log(`\n✅ Deleted ${snap.size} pre-2026 match documents.`);
  console.log("   Recompute the leaderboard from /admin/fixtures to reset all scores.\n");

  await admin.app().delete();
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
