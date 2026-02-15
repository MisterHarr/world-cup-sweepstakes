import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { checkRateLimit, RateLimits } from "./utils/rateLimiter";
import { validateUid, validateBoolean } from "./utils/validation";
const REGION = "asia-southeast1";

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
  const callerUid = requireAdmin(request);

  // Rate limiting for admin operations
  checkRateLimit(callerUid, RateLimits.admin);

  // Input validation
  const targetUid = validateUid(request.data?.uid, "uid");
  const makeAdmin = validateBoolean(request.data?.admin, "admin", false) ?? true;

  await admin.auth().setCustomUserClaims(targetUid, {
    admin: makeAdmin,
  });

  return {
    ok: true,
    uid: targetUid,
    admin: makeAdmin,
  };
});
