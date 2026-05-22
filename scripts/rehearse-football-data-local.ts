export {};

process.env.FIREBASE_EMULATOR_PROJECT ??= "worldcup-sweepstake-2026";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FUNCTIONS_EMULATOR_HOST ??= "127.0.0.1:5001";

type AdminFirestore = FirebaseFirestore.Firestore;

async function collectionCount(db: AdminFirestore, name: string) {
  const snap = await db.collection(name).get();
  return snap.size;
}

async function snapshotState(db: AdminFirestore) {
  const [
    users,
    teams,
    matches,
    shadowMatches,
    providerErrors,
    rawUpdates,
    leaderboard,
    shadowLeaderboard,
    liveOps,
  ] = await Promise.all([
    collectionCount(db, "users"),
    collectionCount(db, "teams"),
    collectionCount(db, "matches"),
    collectionCount(db, "shadowMatches"),
    collectionCount(db, "providerErrors"),
    db.collection("providerRaw").doc("football-data").collection("updates").get(),
    db.collection("leaderboard").doc("current").get(),
    db.collection("shadowLeaderboard").doc("current").get(),
    db.collection("settings").doc("liveOps").get(),
  ]);

  return {
    users,
    teams,
    matches,
    shadowMatches,
    providerErrors,
    providerRawUpdates: rawUpdates.size,
    leaderboardCurrent: leaderboard.exists,
    shadowLeaderboardCurrent: shadowLeaderboard.exists,
    liveOps: liveOps.exists ? liveOps.data() : null,
  };
}

async function ensureTeamsIfEmpty(
  db: AdminFirestore,
  adminLib: {
    firestore: {
      Timestamp: {
        now(): unknown;
      };
    };
  },
  teamsSeed: ReadonlyArray<{ id: string }>
) {
  const existingTeams = await collectionCount(db, "teams");
  if (existingTeams > 0) {
    return { seeded: false, count: existingTeams };
  }

  const batch = db.batch();
  teamsSeed.forEach((team) => {
    batch.set(
      db.collection("teams").doc(team.id),
      {
        ...(team as Record<string, unknown>),
        updatedAt: adminLib.firestore.Timestamp.now(),
      },
      { merge: true }
    );
  });
  await batch.commit();

  return { seeded: true, count: teamsSeed.length };
}

async function main() {
  const helper = await import("../functions/scripts/emulator-test-helpers.cjs");
  const { TEAMS_SEED } = await import("../lib/seed/teamsSeed");

  const {
    admin,
    assert,
    callCallable,
    createAdminUser,
    initializeAdmin,
  } = helper;

  const db = initializeAdmin();
  const before = await snapshotState(db);
  const teamStatus = await ensureTeamsIfEmpty(db, admin, TEAMS_SEED);
  const adminUser = await createAdminUser("football.data.local.rehearsal");

  const settingsResult = await callCallable("setLiveOpsSettings", adminUser.idToken, {
    mode: "shadow",
    provider: "football-data",
    fixtureMaxMatches: 0,
    fixtureCutoffIso: null,
  });

  assert(
    settingsResult.provider === "football-data",
    `Expected provider football-data, got ${settingsResult.provider}`
  );

  const previewResult = await callCallable(
    "adminContractTestProvider",
    adminUser.idToken,
    {
      provider: "football-data",
      dryRun: true,
      maxMatches: 24,
    }
  );

  const runResult = await callCallable(
    "adminContractTestProvider",
    adminUser.idToken,
    {
      provider: "football-data",
      dryRun: false,
      maxMatches: 24,
    }
  );

  const after = await snapshotState(db);

  console.log(
    JSON.stringify(
      {
        teamStatus,
        before,
        settingsResult,
        previewResult,
        runResult,
        after,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
