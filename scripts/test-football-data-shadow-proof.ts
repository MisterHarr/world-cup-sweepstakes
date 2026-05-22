export {};

type AdminFirestore = FirebaseFirestore.Firestore;

async function seedTeams(
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
}

async function seedShadowUser(
  db: AdminFirestore,
  adminLib: {
    firestore: {
      Timestamp: {
        now(): unknown;
      };
    };
  },
  uid: string,
  email: string
) {
  const featuredTeamId = "MEX";
  const drawnTeamIds = ["ZAF", "KOR", "CZE", "CAN", "BIH"];

  await db.collection("users").doc(uid).set(
    {
      email,
      displayName: "Football Data Proof User",
      department: "Primary",
      remainingTransfers: 3,
      totalScore: 0,
      entry: {
        featuredTeamId,
        drawnTeamIds,
      },
      portfolio: [
        { teamId: featuredTeamId, role: "featured" },
        ...drawnTeamIds.map((teamId) => ({ teamId, role: "drawn" })),
      ],
      updatedAt: adminLib.firestore.Timestamp.now(),
    },
    { merge: true }
  );
}

async function getSummary(db: AdminFirestore) {
  const [
    publicMatchesSnap,
    shadowMatchesSnap,
    publicBoardSnap,
    shadowBoardSnap,
    providerErrorsSnap,
    rawUpdatesSnap,
    ingestHealthSnap,
  ] = await Promise.all([
    db.collection("matches").get(),
    db.collection("shadowMatches").get(),
    db.collection("leaderboard").doc("current").get(),
    db.collection("shadowLeaderboard").doc("current").get(),
    db.collection("providerErrors").get(),
    db.collection("providerRaw").doc("football-data").collection("updates").get(),
    db.collection("ingestHealth").doc("current").get(),
  ]);

  const shadowBoard = shadowBoardSnap.data() ?? {};
  const ingestHealth = ingestHealthSnap.data() ?? {};

  return {
    publicMatches: publicMatchesSnap.size,
    shadowMatches: shadowMatchesSnap.size,
    publicLeaderboardExists: publicBoardSnap.exists,
    shadowLeaderboardExists: shadowBoardSnap.exists,
    shadowRows: Array.isArray(shadowBoard.rows) ? shadowBoard.rows.length : 0,
    providerErrors: providerErrorsSnap.size,
    providerRawUpdates: rawUpdatesSnap.size,
    ingestHealth,
    shadowLeaderboard: shadowBoard,
  };
}

async function main() {
  process.env.FIREBASE_EMULATOR_PROJECT ??= "demo-football-data-proof";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FUNCTIONS_EMULATOR_HOST ??= "127.0.0.1:5001";

  const helper = await import("../functions/scripts/emulator-test-helpers.cjs");
  const { TEAMS_SEED } = await import("../lib/seed/teamsSeed");

  const {
    admin,
    assert,
    callCallable,
    createAdminUser,
    ensureSafeProject,
    initializeAdmin,
    purgeCollections,
  } = helper;

  ensureSafeProject();
  const db = initializeAdmin();

  await purgeCollections(db, [
    "users",
    "teams",
    "matches",
    "shadowMatches",
    "leaderboard",
    "shadowLeaderboard",
    "settings",
    "providerErrors",
    "providerRaw",
    "ingestHealth",
    "transferEvents",
    "adminEvents",
  ]);

  await seedTeams(db, admin, TEAMS_SEED);

  const adminUser = await createAdminUser("football.data.contract.admin");
  await seedShadowUser(db, admin, adminUser.uid, adminUser.email);

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

  const summary = await getSummary(db);

  console.log(
    JSON.stringify(
      {
        settingsResult,
        previewResult,
        runResult,
        summary,
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
