"use strict";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const admin = require("firebase-admin");

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/set-emulator-admin.cjs <uid>");
  process.exit(1);
}

admin.initializeApp({ projectId: "worldcup-sweepstake-2026" });

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => admin.auth().getUser(uid))
  .then((user) => {
    console.log("✅ Done. Claims:", user.customClaims);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  });
