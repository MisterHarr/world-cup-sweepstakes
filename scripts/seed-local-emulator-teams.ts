export {};

async function main() {
  process.env.FIREBASE_EMULATOR_PROJECT ??= "worldcup-sweepstake-2026";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const { TEAMS_SEED } = await import("../lib/seed/teamsSeed");
  const admin = adminModule.default ?? adminModule;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.FIREBASE_EMULATOR_PROJECT });
  }

  const db = admin.firestore();
  const batch = db.batch();

  TEAMS_SEED.forEach((team) => {
    batch.set(
      db.collection("teams").doc(team.id),
      {
        ...team,
        teamId: team.id,
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );
  });

  await batch.commit();
  console.log(
    `Seeded ${TEAMS_SEED.length} teams into emulator project ${process.env.FIREBASE_EMULATOR_PROJECT}.`
  );
  await admin.app().delete();
}

main().then(
  () => process.exit(0),
  async (error) => {
    console.error(error);
    process.exit(1);
  }
);
