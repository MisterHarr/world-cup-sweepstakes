#!/usr/bin/env node
/* eslint-disable no-console */

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
const GET_SQUAD_DETAILS_URL =
  `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/getSquadDetails`;

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
  const email = `squad.authz.${label}.${randomSuffix()}@example.test`;
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

async function callGetSquadDetails(idToken, userId) {
  const res = await fetch(GET_SQUAD_DETAILS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: { userId } }),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    return {
      ok: false,
      status: json?.error?.status ?? null,
      message: json?.error?.message ?? "unknown",
    };
  }

  return {
    ok: true,
    data: json.result ?? json.data ?? json,
  };
}

async function seedUsers(db, users) {
  const batch = db.batch();
  users.forEach((user, index) => {
    batch.set(
      db.collection("users").doc(user.uid),
      {
        email: user.email,
        displayName: `Squad User ${index + 1}`,
        remainingTransfers: 3,
        totalScore: 0,
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
  });

  await batch.commit();
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

  const caller = await signUpAuthUser("caller");
  const target = await signUpAuthUser("target");
  await seedUsers(db, [caller, target]);

  const denied = await callGetSquadDetails(caller.idToken, target.uid);
  assert(denied.ok === false, "Expected non-admin cross-user read to fail");
  assert(
    denied.status === "PERMISSION_DENIED",
    `Expected PERMISSION_DENIED, got ${denied.status}`
  );

  await admin.auth().setCustomUserClaims(caller.uid, { admin: true });
  const adminToken = await signInAuthUser(caller.email, caller.password);

  const allowed = await callGetSquadDetails(adminToken, target.uid);
  assert(allowed.ok === true, "Expected admin cross-user read to succeed");
  assert(allowed.data?.ok === true, "Callable payload missing ok=true");
  assert(
    allowed.data?.userId === target.uid,
    `Expected userId=${target.uid}, got ${allowed.data?.userId}`
  );

  console.log("PASS: getSquadDetails authz regression test succeeded.");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
