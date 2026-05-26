#!/usr/bin/env node
/* eslint-disable no-console */

const fixtures = require("../src/fixtures/worldcup2022.json");
const {
  admin,
  assert,
  callCallable,
  createAdminUser,
  ensureSafeProject,
  initializeAdmin,
  purgeCollections,
} = require("./emulator-test-helpers.cjs");

function uniqueTeamIds(limit) {
  const ids = new Set();
  const slice = Array.isArray(fixtures) ? fixtures.slice(0, limit) : [];
  slice.forEach((match) => {
    if (typeof match?.homeTeamId === "string") ids.add(match.homeTeamId);
    if (typeof match?.awayTeamId === "string") ids.add(match.awayTeamId);
  });
  return Array.from(ids);
}

async function seedTeams(db, teamIds) {
  const batch = db.batch();
  teamIds.forEach((teamId, index) => {
    batch.set(
      db.collection("teams").doc(teamId),
      {
        id: teamId,
        name: `Team ${teamId}`,
        group: String.fromCharCode(65 + (index % 8)),
        tier: (index % 4) + 1,
      },
      { merge: true }
    );
  });
  await batch.commit();
}

async function seedShadowUser(db, uid, email) {
  await db.collection("users").doc(uid).set(
    {
      email,
      displayName: "Shadow Routing User",
      department: "Primary",
      remainingTransfers: 3,
      totalScore: 0,
      entry: {
        featuredTeamId: "QAT",
        drawnTeamIds: ["ECU", "ENG", "IRN", "NED", "SEN"],
      },
      portfolio: [
        { teamId: "QAT", role: "featured" },
        { teamId: "ECU", role: "drawn" },
        { teamId: "ENG", role: "drawn" },
        { teamId: "IRN", role: "drawn" },
        { teamId: "NED", role: "drawn" },
        { teamId: "SEN", role: "drawn" },
      ],
      updatedAt: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
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

  const adminUser = await createAdminUser("shadow.mode.admin");
  await seedTeams(db, uniqueTeamIds(4));
  await seedShadowUser(db, adminUser.uid, adminUser.email);

  const settingsResult = await callCallable("setLiveOpsSettings", adminUser.idToken, {
    mode: "shadow",
    provider: "fixture",
    fixtureMaxMatches: 4,
    fixtureCutoffIso: null,
  });

  assert(settingsResult.mode === "shadow", "Expected live ops mode to save as shadow");

  const ingestResult = await callCallable("adminIngestFixture", adminUser.idToken, {
    maxMatches: 4,
  });

  assert(ingestResult.ok === true, "Expected shadow adminIngestFixture ok=true");
  assert(ingestResult.mode === "shadow", `Expected mode=shadow, got ${ingestResult.mode}`);
  assert(
    ingestResult.target === "shadowMatches",
    `Expected target=shadowMatches, got ${ingestResult.target}`
  );
  assert(ingestResult.updated === 4, `Expected updated=4, got ${ingestResult.updated}`);
  assert(
    ingestResult.quarantined === 0,
    `Expected quarantined=0, got ${ingestResult.quarantined}`
  );

  const [publicMatchesSnap, shadowMatchesSnap, publicBoardSnap, shadowBoardSnap] =
    await Promise.all([
      db.collection("matches").get(),
      db.collection("shadowMatches").get(),
      db.collection("leaderboard").doc("current").get(),
      db.collection("shadowLeaderboard").doc("current").get(),
    ]);

  assert(publicMatchesSnap.empty, "Expected public matches to stay untouched in shadow mode");
  assert(
    shadowMatchesSnap.size === 4,
    `Expected 4 shadow matches, got ${shadowMatchesSnap.size}`
  );
  assert(!publicBoardSnap.exists, "Expected public leaderboard/current to remain untouched");
  assert(shadowBoardSnap.exists, "Expected shadowLeaderboard/current to exist");

  const shadowBoard = shadowBoardSnap.data() || {};
  assert(
    shadowBoard.target === "shadow",
    `Expected shadow leaderboard target=shadow, got ${shadowBoard.target}`
  );
  assert(
    shadowBoard.sourceCollection === "shadowMatches",
    `Expected sourceCollection=shadowMatches, got ${shadowBoard.sourceCollection}`
  );
  assert(
    Array.isArray(shadowBoard.rows) && shadowBoard.rows.length === 1,
    "Expected shadow leaderboard rows to contain the seeded user"
  );

  console.log("PASS: shadow mode routing regression test succeeded.");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
