#!/usr/bin/env node

const admin = require("firebase-admin");

const [, , emailArg, passwordArg, displayNameArg] = process.argv;
const email = typeof emailArg === "string" ? emailArg.trim().toLowerCase() : "";
const password = typeof passwordArg === "string" ? passwordArg : "";
const displayName =
  typeof displayNameArg === "string" && displayNameArg.trim()
    ? displayNameArg.trim()
    : "Local Admin";

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    "Refusing to run without FIREBASE_AUTH_EMULATOR_HOST. This helper is for the local Auth Emulator only."
  );
  process.exit(1);
}

if (!email || !email.includes("@")) {
  console.error("Usage: node create-local-admin.cjs <email> <password> [displayName]");
  process.exit(1);
}

if (!password || password.length < 6) {
  console.error("Password must be at least 6 characters.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "worldcup-sweepstake-2026" });
}

async function run() {
  const auth = admin.auth();
  let user;

  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, {
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (err) {
    if (err && err.code !== "auth/user-not-found") {
      throw err;
    }
    user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(user.uid, { admin: true });

  console.log(`Local admin ready: ${email}`);
  console.log(`UID: ${user.uid}`);
  console.log("Claim: admin=true");
  console.log("Sign out/in once if your browser already had an old token.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
