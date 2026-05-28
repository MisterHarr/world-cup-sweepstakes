/**
 * Fully removes a user: Auth record, Firestore doc, leaderboard row.
 * Usage: GCLOUD_PROJECT=worldcup-sweepstake-2026 npx tsx scripts/delete-user-and-cleanup.ts <uid>
 */
export {};

async function main() {
  const uid = process.argv[2]?.trim();
  if (!uid) { console.error("Usage: delete-user-and-cleanup.ts <uid>"); process.exit(1); }

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const sa = require("../service-account.json");
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

  const db = admin.firestore();

  // 1. Delete Auth account
  try {
    await admin.auth().deleteUser(uid);
    console.log(`✅ Auth account deleted: ${uid}`);
  } catch (e: unknown) {
    console.warn(`⚠️  Auth delete failed (may already be gone): ${(e as Error).message}`);
  }

  // 2. Delete Firestore user doc
  await db.collection("users").doc(uid).delete();
  console.log(`✅ Firestore user doc deleted`);

  // 3. Remove from leaderboard/current rows
  const lbRef = db.collection("leaderboard").doc("current");
  const lbSnap = await lbRef.get();
  if (lbSnap.exists) {
    const data = lbSnap.data() as Record<string, unknown>;
    if (Array.isArray(data.rows)) {
      const filtered = (data.rows as Record<string, unknown>[]).filter(
        (row) => row.userId !== uid
      );
      // Re-rank
      filtered.forEach((row, i) => { row.rank = i + 1; });
      await lbRef.update({ rows: filtered, rowCount: filtered.length });
      console.log(`✅ Removed from leaderboard (${data.rows.length} → ${filtered.length} rows)`);
    }
  }

  console.log("Done.");
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exit(1); });
