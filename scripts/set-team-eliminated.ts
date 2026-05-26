/**
 * set-team-eliminated.ts
 * ──────────────────────
 * Flips isEliminated on a team document in the emulator so you can preview
 * the eliminated card UI without waiting for a real knock-out.
 *
 * Usage:
 *   npx tsx scripts/set-team-eliminated.ts                      # list all teams
 *   npx tsx scripts/set-team-eliminated.ts --id <teamId>        # eliminate a team
 *   npx tsx scripts/set-team-eliminated.ts --id <teamId> --restore  # un-eliminate
 *   npx tsx scripts/set-team-eliminated.ts --all                # eliminate every team
 *   npx tsx scripts/set-team-eliminated.ts --all --restore      # restore all
 */
export {};

async function main() {
  const args = process.argv.slice(2);
  const restore = args.includes("--restore");
  const all = args.includes("--all");
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
  const teamsRef = db.collection("teams");

  // List mode — no flags
  if (!targetId && !all) {
    const snap = await teamsRef.orderBy("name").get();
    if (snap.empty) {
      console.log("No team documents found. Run the team seed first.");
      process.exit(0);
    }
    console.log("\nAvailable teams:\n");
    snap.forEach((doc) => {
      const d = doc.data();
      const elim = d.isEliminated === true ? " 🔴 ELIMINATED" : "";
      console.log(`  ${doc.id.padEnd(36)}  ${(d.name as string ?? "").padEnd(28)}${elim}`);
    });
    console.log(
      "\nRun with --id <teamId> to toggle, or --all to eliminate/restore all.\n"
    );
    process.exit(0);
  }

  const newValue = !restore;

  if (all) {
    const snap = await teamsRef.get();
    const batch = db.batch();
    snap.forEach((doc) => batch.update(doc.ref, { isEliminated: newValue }));
    await batch.commit();
    console.log(
      `✅ All ${snap.size} teams → isEliminated: ${newValue}`
    );
  } else if (targetId) {
    const ref = teamsRef.doc(targetId);
    const doc = await ref.get();
    if (!doc.exists) {
      console.error(`Team "${targetId}" not found.`);
      process.exit(1);
    }
    await ref.update({ isEliminated: newValue });
    console.log(`✅ Team "${targetId}" (${doc.data()?.name}) → isEliminated: ${newValue}`);
  }

  await admin.app().delete();
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
