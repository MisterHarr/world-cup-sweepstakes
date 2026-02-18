import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
const REGION = "asia-southeast1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Prevent double init during hot reloads
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * setAdminClaim
 * Securely sets or removes the `admin` custom claim on a user.
 *
 * RULES:
 * - Caller MUST already be admin
 * - This avoids using a writable Firestore `admins` collection
 */
export const setAdminClaim = onCall({ region: REGION }, async (request) => {
  requireAdmin(request);

  const payload = isRecord(request.data) ? request.data : {};
  const targetUid =
    typeof payload.uid === "string" ? payload.uid.trim() : String(payload.uid ?? "");
  const makeAdmin =
    payload.admin === undefined ? true : Boolean(payload.admin);

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing target uid.");
  }

  await admin.auth().setCustomUserClaims(targetUid, {
    admin: makeAdmin,
  });

  return {
    ok: true,
    uid: targetUid,
    admin: makeAdmin,
  };
});
