const admin = require("firebase-admin");

// IMPORTANT: set your Firebase project id explicitly
const PROJECT_ID = "worldcup-sweepstake-2026";

admin.initializeApp({
  projectId: PROJECT_ID,
});

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node set-first-admin.cjs <UID>");
  process.exit(1);
}

admin
  .auth()
  .setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✅ Set custom claim admin=true for uid: ${uid}`);
    console.log(`ℹ️ Project: ${PROJECT_ID}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed to set custom claims:", err);
    process.exit(1);
  });
