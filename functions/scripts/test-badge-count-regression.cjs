#!/usr/bin/env node

const admin = require("firebase-admin");

const REGION = process.env.FUNCTIONS_REGION || "asia-southeast1";
const PROJECT_ID =
  process.env.FIREBASE_EMULATOR_PROJECT || "demo-worldcup-loadtest";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";

const AUTH_SIGNUP_URL =
  `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`;
const AUTH_SIGNIN_URL =
  `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`;
const RECOMPUTE_SCORES_URL =
  `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/recomputeScores`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function randomSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function purgeCollection(db, name) {
  while (true) {
    const snap = await db.collection(name).limit(400).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function signUpAuthUser(label) {
  const email = `badge.regression.${label}.${randomSuffix()}@example.test`;
  const password = "P@ssw0rd!123";

  const res = await fetch(AUTH_SIGNUP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(`Auth signUp failed (${res.status}): ${JSON.stringify(json)}`);
  }

  return {
    uid: json.localId,
    idToken: json.idToken,
    email,
    password,
  };
}

async function signInAuthUser(email, password) {
  const res = await fetch(AUTH_SIGNIN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(`Auth signIn failed (${res.status}): ${JSON.stringify(json)}`);
  }

  return json.idToken;
}

function seedUserDoc(db, uid, displayName, badgePayload) {
  return db.collection("users").doc(uid).set(
    {
      displayName,
      department: "Primary",
      remainingTransfers: 3,
      entry: {
        featuredTeamId: "T1",
        drawnTeamIds: ["T2", "T3", "T4", "T5", "T6"],
      },
      portfolio: [
        { teamId: "T1", role: "featured" },
        { teamId: "T2", role: "drawn" },
        { teamId: "T3", role: "drawn" },
        { teamId: "T4", role: "drawn" },
        { teamId: "T5", role: "drawn" },
        { teamId: "T6", role: "drawn" },
      ],
      updatedAt: admin.firestore.Timestamp.now(),
      ...badgePayload,
    },
    { merge: true }
  );
}

async function seedBaseData(db, users) {
  const batch = db.batch();
  const teamIds = ["T1", "T2", "T3", "T4", "T5", "T6"];
  teamIds.forEach((teamId) => {
    batch.set(
      db.collection("teams").doc(teamId),
      {
        id: teamId,
        name: `Team ${teamId}`,
        group: "A",
        tier: 2,
      },
      { merge: true }
    );
  });
  await batch.commit();

  await seedUserDoc(db, users.admin.uid, "Badge Admin", {});
  await seedUserDoc(db, users.earned.uid, "Badge Earned", {
    earnedBadges: [
      "engage_early_bird",
      { badgeId: "engage_first_transfer" },
      { badgeId: "engage_social", unlocked: false },
    ],
  });
  await seedUserDoc(db, users.array.uid, "Badge Array", {
    badges: [
      { badgeId: "perf_top10", unlocked: true },
      { badgeId: "perf_comeback", unlocked: false },
      { badgeId: "pred_group_winner" },
    ],
  });
  await seedUserDoc(db, users.map.uid, "Badge Map", {
    badges: {
      pred_group_winner: true,
      pred_dark_horse: { unlocked: true },
      pred_final_four: { unlockedAt: "2026-02-22T10:00:00Z" },
      ignored_locked: { unlocked: false },
      ignored_empty: {},
    },
  });
  await seedUserDoc(db, users.timestamp.uid, "Badge Timestamp", {
    badges: {
      engage_first_transfer: { unlockedAt: admin.firestore.Timestamp.now() },
      ignored_false: false,
    },
  });
}

async function callRecomputeScores(idToken) {
  const res = await fetch(RECOMPUTE_SCORES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      data: {
        includeLive: false,
        scoringVersion: "badge-regression-v1",
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(
      `recomputeScores failed (${res.status}): ${JSON.stringify(json)}`
    );
  }

  return json.result ?? json.data ?? json;
}

async function verifyLeaderboardBadgeCounts(db, expectedByUid) {
  const leaderboardSnap = await db.collection("leaderboard").doc("current").get();
  assert(leaderboardSnap.exists, "leaderboard/current missing after recompute");

  const leaderboard = leaderboardSnap.data() || {};
  const rows = Array.isArray(leaderboard.rows) ? leaderboard.rows : [];
  Object.entries(expectedByUid).forEach(([uid, expected]) => {
    const row = rows.find((candidate) => candidate && candidate.userId === uid);
    assert(Boolean(row), `Leaderboard row missing for uid=${uid}`);
    assert(
      Number(row.badgeCount) === expected,
      `Expected badgeCount=${expected} for uid=${uid}, got ${row.badgeCount}`
    );
  });
}

async function main() {
  if (!PROJECT_ID.startsWith("demo-")) {
    throw new Error(
      `Safety check failed: projectId must start with demo- (got ${PROJECT_ID})`
    );
  }

  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const db = admin.firestore();
  await purgeCollection(db, "users");
  await purgeCollection(db, "teams");
  await purgeCollection(db, "matches");
  await purgeCollection(db, "transferEvents");
  await purgeCollection(db, "leaderboard");

  const adminUser = await signUpAuthUser("admin");
  const earnedUser = await signUpAuthUser("earned");
  const arrayUser = await signUpAuthUser("array");
  const mapUser = await signUpAuthUser("map");
  const timestampUser = await signUpAuthUser("timestamp");

  await admin.auth().setCustomUserClaims(adminUser.uid, { admin: true });
  const adminToken = await signInAuthUser(adminUser.email, adminUser.password);

  await seedBaseData(db, {
    admin: adminUser,
    earned: earnedUser,
    array: arrayUser,
    map: mapUser,
    timestamp: timestampUser,
  });

  const result = await callRecomputeScores(adminToken);
  assert(result?.ok === true, "recomputeScores payload missing ok=true");

  await verifyLeaderboardBadgeCounts(db, {
    [adminUser.uid]: 0,
    [earnedUser.uid]: 2,
    [arrayUser.uid]: 2,
    [mapUser.uid]: 3,
    [timestampUser.uid]: 1,
  });

  console.log("PASS: badge count regression test succeeded.");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
