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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function randomSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureSafeProject() {
  if (!PROJECT_ID.startsWith("demo-")) {
    throw new Error(
      `Safety check failed: projectId must start with demo- (got ${PROJECT_ID})`
    );
  }
}

function initializeAdmin() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  return admin.firestore();
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

async function purgeCollections(db, names) {
  for (const name of names) {
    await purgeCollection(db, name);
  }
}

async function signUpAuthUser(label) {
  const email = `${label}.${randomSuffix()}@example.test`;
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

async function createAdminUser(label) {
  const user = await signUpAuthUser(label);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  const idToken = await signInAuthUser(user.email, user.password);
  return {
    ...user,
    idToken,
  };
}

async function callCallable(functionName, idToken, data) {
  const url = `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/${functionName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(idToken ? { authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data: data ?? {} }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const message =
      typeof json?.error?.message === "string"
        ? json.error.message
        : JSON.stringify(json);
    const error = new Error(`${functionName} failed (${res.status}): ${message}`);
    error.status = res.status;
    error.body = json;
    throw error;
  }

  return json.result ?? json.data ?? json;
}

module.exports = {
  admin,
  assert,
  createAdminUser,
  callCallable,
  ensureSafeProject,
  initializeAdmin,
  purgeCollections,
  randomSuffix,
};
