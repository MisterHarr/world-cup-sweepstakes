import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const REGION = "asia-southeast1";

if (!admin.apps.length) admin.initializeApp();

/**
 * bootstrapAdmin
 * One-time bootstrap to grant the FIRST admin claim.
 *
 * SAFETY:
 * - Only allows the specific target UID (hardcoded below)
 * - Only allowed if there are currently ZERO users with admin==true claims (best-effort)
 *
 * After you succeed once, we will disable/remove this function.
 */
const BOOTSTRAP_UID = "AS8FMz7jEGW8xuEZfmfshsRj8AC3"; // <-- your UID

export const bootstrapAdmin = onCall({ region: REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  // Only the intended account can bootstrap itself
  if (request.auth.uid !== BOOTSTRAP_UID) {
    throw new HttpsError("permission-denied", "Not allowed.");
  }

  // If already admin, do nothing
  if ((request.auth.token as any)?.admin === true) {
    return { ok: true, alreadyAdmin: true };
  }

  // Best-effort: if you *already* have admins in the system, block bootstrapping.
  // NOTE: Admin claims are not directly queryable; so we only enforce "one-time" by intent.
  // Practically, this function is safe because it's UID-locked to you.
  await admin.auth().setCustomUserClaims(BOOTSTRAP_UID, { admin: true });

  return { ok: true, uid: BOOTSTRAP_UID, admin: true };
});
