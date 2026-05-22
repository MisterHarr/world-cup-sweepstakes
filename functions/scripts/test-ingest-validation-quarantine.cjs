#!/usr/bin/env node
/* eslint-disable no-console */

const {
  assert,
  callCallable,
  createAdminUser,
  ensureSafeProject,
  initializeAdmin,
  purgeCollections,
} = require("./emulator-test-helpers.cjs");

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

  const adminUser = await createAdminUser("ingest.validation.admin");
  const settingsResult = await callCallable("setLiveOpsSettings", adminUser.idToken, {
    mode: "production",
    provider: "fixture",
    fixtureMaxMatches: 4,
    fixtureCutoffIso: null,
  });
  assert(
    settingsResult.mode === "production",
    `Expected live ops mode=production, got ${settingsResult.mode}`
  );

  const result = await callCallable("adminIngestFixture", adminUser.idToken, {
    maxMatches: 4,
  });

  assert(result.ok === true, "Expected adminIngestFixture ok=true");
  assert(result.matches === 4, `Expected matches=4, got ${result.matches}`);
  assert(result.updated === 0, `Expected updated=0, got ${result.updated}`);
  assert(
    result.quarantined === 4,
    `Expected quarantined=4, got ${result.quarantined}`
  );

  const [matchesSnap, shadowSnap, errorsSnap, rawProviderSnap] = await Promise.all([
    db.collection("matches").get(),
    db.collection("shadowMatches").get(),
    db.collection("providerErrors").get(),
    db.collection("providerRaw").doc("fixture-replay").collection("updates").get(),
  ]);

  assert(matchesSnap.empty, "Expected no public matches to be written");
  assert(shadowSnap.empty, "Expected no shadow matches to be written");
  assert(
    errorsSnap.size === 4,
    `Expected 4 quarantined providerErrors, got ${errorsSnap.size}`
  );
  assert(
    rawProviderSnap.size === 4,
    `Expected 4 providerRaw update summaries, got ${rawProviderSnap.size}`
  );

  console.log("PASS: ingest validation quarantine regression test succeeded.");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
