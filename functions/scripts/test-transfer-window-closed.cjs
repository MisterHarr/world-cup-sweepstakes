#!/usr/bin/env node
/* eslint-disable no-console */

const admin = require("firebase-admin");

const REGION = process.env.FUNCTIONS_REGION || "asia-southeast1";
const PROJECT_ID =
  process.env.FIREBASE_EMULATOR_PROJECT || "demo-worldcup-loadtest";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";

const AUTH_SIGNUP_URL = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`;
const EXECUTE_TRANSFER_URL = `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/executeTransfer`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function signUpAuthUser() {
  const email = `transfer.closed.${randomSuffix()}@example.test`;
  const password = "P@ssw0rd!123";

  const res = await fetch(AUTH_SIGNUP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      `Auth signUp failed (${res.status}): ${JSON.stringify(json)}`
    );
  }

  return { uid: json.localId, idToken: json.idToken, email };
}

async function seedClosedWindowData(db, uid, email) {
  const batch = db.batch();
  const teamIds = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];

  teamIds.forEach((id) => {
    batch.set(
      db.collection("teams").doc(id),
      { id, name: `Team ${id}`, group: "A", tier: 1 },
      { merge: true }
    );
  });

  batch.set(
    db.collection("settings").doc("transferWindow"),
    {
      enabled: false,
      startsAt: admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60_000),
      endsAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 60_000),
      updatedAt: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );

  batch.set(
    db.collection("users").doc(uid),
    {
      email,
      displayName: "Transfer Closed Window User",
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
    },
    { merge: true }
  );

  await batch.commit();
}

async function callExecuteTransfer(idToken) {
  const res = await fetch(EXECUTE_TRANSFER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: { dropTeamId: "T2", pickupTeamId: "T7" } }),
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function verifyBlocked(db, uid, result) {
  const error = result.body?.error;
  const message = typeof error?.message === "string" ? error.message : "";

  assert(
    result.status === 400,
    `Expected HTTP 400 for blocked transfer, got ${result.status}`
  );
  assert(Boolean(error), "Expected callable error payload for blocked transfer");
  assert(
    message.includes("Transfer window is closed"),
    `Expected 'Transfer window is closed' message, got: ${message || "(empty)"}`
  );

  const transferEventsSnap = await db
    .collection("transferEvents")
    .where("uid", "==", uid)
    .get();
  assert(
    transferEventsSnap.size === 0,
    `Expected 0 transfer events for blocked call, got ${transferEventsSnap.size}`
  );

  const userSnap = await db.collection("users").doc(uid).get();
  assert(userSnap.exists, "users/{uid} missing after blocked transfer");
  const user = userSnap.data() || {};
  assert(
    Number(user.remainingTransfers) === 3,
    `Expected remainingTransfers to remain 3, got ${user.remainingTransfers}`
  );

  const entryDrawn = Array.isArray(user.entry?.drawnTeamIds)
    ? user.entry.drawnTeamIds
    : [];
  assert(
    entryDrawn.includes("T2"),
    "Expected drawn squad to remain unchanged (T2 still present)"
  );
}

async function main() {
  if (!PROJECT_ID.startsWith("demo-")) {
    throw new Error(
      `Safety check failed: projectId must start with demo- (got ${PROJECT_ID})`
    );
  }

  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const db = admin.firestore();
  await purgeCollection(db, "users");
  await purgeCollection(db, "teams");
  await purgeCollection(db, "settings");
  await purgeCollection(db, "transferEvents");
  await purgeCollection(db, "matches");
  await purgeCollection(db, "leaderboard");

  const authUser = await signUpAuthUser();
  await seedClosedWindowData(db, authUser.uid, authUser.email);
  const result = await callExecuteTransfer(authUser.idToken);
  await verifyBlocked(db, authUser.uid, result);

  console.log("PASS: transfer window closed guardrail regression test succeeded.");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
