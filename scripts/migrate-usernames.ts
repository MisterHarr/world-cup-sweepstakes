/**
 * migrate-usernames.ts
 *
 * One-time migration (Bundle 3 — setUsername race-condition fix).
 * Seeds the `usernames/{usernameLower}` collection from existing
 * users/{uid}.username values so that the new atomic uniqueness lock
 * is consistent with usernames already in the system.
 *
 * The document ID is the lowercase username; the data is `{ uid }`.
 * This matches the convention used by the updated setUsername function.
 *
 * Idempotent — safe to run multiple times. Already-correct locks are
 * skipped. Conflicts (two users with the same lowercase username) are
 * reported and cause a non-zero exit so they can be resolved manually
 * before deploying Bundle 3.
 *
 * Usage:
 *   GCLOUD_PROJECT=worldcup-sweepstake-2026 npx tsx scripts/migrate-usernames.ts
 *
 * Or directly (service-account.json at repo root is used automatically):
 *   npx tsx scripts/migrate-usernames.ts
 */
export {};

async function main() {
  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const sa = require("../service-account.json");

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }

  const db = admin.firestore();
  const PROJECT = (sa as Record<string, string>).project_id ?? "unknown";
  console.log(`\n📋  migrate-usernames — project: ${PROJECT}\n`);

  const usersSnap = await db.collection("users").get();
  let seeded = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data() as Record<string, unknown>;
    const username =
      typeof data.username === "string" ? data.username.trim() : null;

    if (!username) {
      skipped++;
      continue;
    }

    const usernameLower = username.toLowerCase();
    const lockRef = db.collection("usernames").doc(usernameLower);
    const lockSnap = await lockRef.get();

    if (lockSnap.exists) {
      const existing = (lockSnap.data() ?? {}) as Record<string, unknown>;
      if (existing.uid === userDoc.id) {
        console.log(`  ✓  SKIP (already seeded)  usernames/${usernameLower}  →  ${userDoc.id}`);
        skipped++;
      } else {
        const msg =
          `  ✗  CONFLICT  usernames/${usernameLower}  already owned by ${existing.uid}, ` +
          `cannot assign to ${userDoc.id} (display: "${username}")`;
        console.error(msg);
        conflicts.push(msg);
      }
      continue;
    }

    await lockRef.set({ uid: userDoc.id });
    console.log(`  +  SEEDED  usernames/${usernameLower}  →  ${userDoc.id}  (display: "${username}")`);
    seeded++;
  }

  console.log(`\nResult: seeded=${seeded}  skipped=${skipped}  conflicts=${conflicts.length}\n`);

  if (conflicts.length > 0) {
    console.error("Conflicts detected — resolve before deploying Bundle 3:");
    conflicts.forEach((c) => console.error(c));
    process.exit(1);
  }

  console.log("✅  Migration complete. Safe to deploy Bundle 3.");
}

main().catch((err: unknown) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
