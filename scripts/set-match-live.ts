/**
 * set-match-live.ts
 * ─────────────────
 * Grabs the first upcoming match in the emulator's `matches` collection and
 * flips its status to "LIVE" (and optionally restores it).
 *
 * Usage:
 *   npx tsx scripts/set-match-live.ts            # set first match to LIVE
 *   npx tsx scripts/set-match-live.ts --restore  # set it back to SCHEDULED
 *   npx tsx scripts/set-match-live.ts --id <matchId>  # target a specific doc
 */
export {};

async function main() {
  const args = process.argv.slice(2);
  const restore = args.includes("--restore");
  const idIdx = args.indexOf("--id");
  const targetId: string | null = idIdx !== -1 ? args[idIdx + 1] : null;

  process.env.FIREBASE_EMULATOR_PROJECT ??= "worldcup-sweepstake-2026";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = adminModule.default ?? adminModule;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.FIREBASE_EMULATOR_PROJECT });
  }

  const db = admin.firestore();
  const matchesRef = db.collection("matches");

  let matchId: string;

  if (targetId) {
    matchId = targetId;
  } else {
    // Find first non-finished match
    const snap = await matchesRef
      .where("status", "not-in", ["FINISHED", "FINAL", "FT"])
      .limit(1)
      .get();

    if (snap.empty) {
      // Fallback: just grab first doc
      const all = await matchesRef.limit(1).get();
      if (all.empty) {
        console.error("No match documents found in emulator. Run the fixture seed first.");
        process.exit(1);
      }
      matchId = all.docs[0].id;
    } else {
      matchId = snap.docs[0].id;
    }
  }

  const newStatus = restore ? "SCHEDULED" : "LIVE";
  await matchesRef.doc(matchId).set(
    {
      status: newStatus,
      isLive: !restore,
      ...(restore ? {} : { s1: 0, s2: 0 }), // seed a 0-0 score when going live
    },
    { merge: true }
  );

  console.log(`✅ Match ${matchId} → status: "${newStatus}"`);
  await admin.app().delete();
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
