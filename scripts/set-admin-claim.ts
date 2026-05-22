/**
 * Bootstrap an admin custom claim on a Firebase Auth user.
 *
 * Requires Application Default Credentials (gcloud auth application-default login)
 * or GOOGLE_APPLICATION_CREDENTIALS pointing to a service account key.
 *
 * Usage:
 *   npx ts-node --esm -T scripts/set-admin-claim.ts <uid> [true|false]
 *
 * Examples:
 *   npx ts-node --esm -T scripts/set-admin-claim.ts Ipl1YTcHQkXXA00lBlzpjTWyKmh1
 *   npx ts-node --esm -T scripts/set-admin-claim.ts Ipl1YTcHQkXXA00lBlzpjTWyKmh1 true
 *   npx ts-node --esm -T scripts/set-admin-claim.ts SomeOtherUid false
 */
export {};

async function main() {
  const args = process.argv.slice(2);
  const uid = args[0]?.trim();
  const makeAdmin = args[1]?.trim() !== "false";

  if (!uid) {
    console.error("Usage: set-admin-claim.ts <uid> [true|false]");
    process.exit(1);
  }

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  // Verify the user exists
  let userRecord: import("firebase-admin/auth").UserRecord;
  try {
    userRecord = await admin.auth().getUser(uid);
  } catch {
    console.error(`User not found: ${uid}`);
    process.exit(1);
  }

  // Set custom claim
  await admin.auth().setCustomUserClaims(uid, { admin: makeAdmin });

  console.log(
    `✅ Set admin=${makeAdmin} for user ${uid} (${userRecord.email ?? "no email"}).`
  );
  console.log(
    "   Sign out and sign back in for the new claim to take effect immediately."
  );
  console.log(
    "   (Claims automatically refresh every hour without re-sign-in.)"
  );
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
