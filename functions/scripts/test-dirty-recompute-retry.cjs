#!/usr/bin/env node
/* eslint-disable no-console */

const {
  admin,
  assert,
  callCallable,
  createAdminUser,
  ensureSafeProject,
  initializeAdmin,
  purgeCollections,
} = require("./emulator-test-helpers.cjs");

async function seedTeams(db) {
  const batch = db.batch();
  [
    { id: "QAT", name: "Qatar", group: "A", tier: 1 },
    { id: "ECU", name: "Ecuador", group: "A", tier: 2 },
  ].forEach((team) => {
    batch.set(db.collection("teams").doc(team.id), team, { merge: true });
  });
  await batch.commit();
}

async function seedUserAndMatch(db, uid, email) {
  const batch = db.batch();
  batch.set(
    db.collection("users").doc(uid),
    {
      email,
      displayName: "Dirty Retry User",
      department: "Primary",
      remainingTransfers: 3,
      totalScore: 0,
      entry: {
        featuredTeamId: "QAT",
        drawnTeamIds: ["ECU"],
      },
      portfolio: [
        { teamId: "QAT", role: "featured" },
        { teamId: "ECU", role: "drawn" },
      ],
      updatedAt: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
  batch.set(
    db.collection("matches").doc("wc2022-001"),
    {
      matchId: "wc2022-001",
      homeTeamId: "QAT",
      awayTeamId: "ECU",
      homeScore: 0,
      awayScore: 2,
      status: "FINISHED",
      stage: "GROUP",
      kickoffTime: "2022-11-20T16:00:00Z",
      source: "fixture",
      provider: "fixture-replay",
      lastUpdated: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
  batch.set(
    db.collection("ingestHealth").doc("current"),
    {
      scoresDirty: true,
      dirtyReason: "transfer",
      lastRecomputeErrorMessage: "Injected dirty state for retry coverage",
      lastRecomputeErrorAt: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
  await batch.commit();
}

async function main() {
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
  ]);

  const adminUser = await createAdminUser("dirty.retry.admin");
  await seedTeams(db);
  await seedUserAndMatch(db, adminUser.uid, adminUser.email);

  const result = await callCallable("retryDirtyRecompute", adminUser.idToken, {
    includeLive: true,
    scoringVersion: "v1",
  });

  assert(result.ok === true, "Expected retryDirtyRecompute ok=true");
  assert(result.wasDirty === true, "Expected retryDirtyRecompute wasDirty=true");
  assert(
    result.dirtyReason === "transfer",
    `Expected dirtyReason=transfer, got ${result.dirtyReason}`
  );

  const [healthSnap, leaderboardSnap, userSnap] = await Promise.all([
    db.collection("ingestHealth").doc("current").get(),
    db.collection("leaderboard").doc("current").get(),
    db.collection("users").doc(adminUser.uid).get(),
  ]);

  assert(leaderboardSnap.exists, "Expected leaderboard/current to exist after retry");
  const leaderboard = leaderboardSnap.data() || {};
  const rows = Array.isArray(leaderboard.rows) ? leaderboard.rows : [];
  const row = rows.find((entry) => entry && entry.userId === adminUser.uid);
  assert(Boolean(row), "Expected leaderboard row for retry test user");
  assert(Number(row.totalScore) === 6, `Expected leaderboard totalScore=6, got ${row.totalScore}`);

  const health = healthSnap.data() || {};
  assert(health.scoresDirty === false, "Expected scoresDirty to be cleared after retry");
  assert(
    health.dirtyReason === null,
    `Expected dirtyReason to be cleared, got ${health.dirtyReason}`
  );

  const user = userSnap.data() || {};
  assert(Number(user.totalScore) === 6, `Expected user totalScore=6, got ${user.totalScore}`);

  console.log("PASS: dirty recompute retry regression test succeeded.");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
