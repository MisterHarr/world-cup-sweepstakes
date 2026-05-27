/**
 * Prize Pot — Cloud Functions
 *
 * confirmPotEntry  (admin-only callable)
 *   Records that a player has paid into the prize pot.
 *   All writes go through this function — no client writes to potEntries.
 *   Idempotent: calling twice for the same uid updates paidAt / confirmedBy.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { CALL_OPTS } from "./runtimeConfig";

const db = () => admin.firestore();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Shape written to potEntries/{uid}. */
interface PotEntry {
  uid: string;
  displayName: string;
  paidAt: admin.firestore.FieldValue;
  amount: number;
  currency: string;
  confirmedBy: string;
  note: string;
}

export const confirmPotEntry = onCall(CALL_OPTS, async (request) => {
  const adminAuth = requireAdmin(request);

  const payload = isRecord(request.data) ? request.data : {};

  const targetUid =
    typeof payload.uid === "string" ? payload.uid.trim() : "";
  const amount =
    typeof payload.amount === "number" && payload.amount > 0
      ? payload.amount
      : 0;
  const currency =
    typeof payload.currency === "string" && payload.currency.trim()
      ? payload.currency.trim()
      : "RM";
  const note =
    typeof payload.note === "string" ? payload.note.trim() : "";

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing uid.");
  }
  if (amount <= 0) {
    throw new HttpsError("invalid-argument", "amount must be a positive number.");
  }

  // Resolve the player's display name from users/{uid}
  const userSnap = await db().collection("users").doc(targetUid).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", `User ${targetUid} not found.`);
  }
  const userData = userSnap.data() as { displayName?: string };
  const displayName =
    typeof userData.displayName === "string" && userData.displayName.trim()
      ? userData.displayName.trim()
      : targetUid;

  const entry: PotEntry = {
    uid: targetUid,
    displayName,
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    amount,
    currency,
    confirmedBy: adminAuth.uid,
    note,
  };

  await db().collection("potEntries").doc(targetUid).set(entry);

  return {
    ok: true,
    uid: targetUid,
    displayName,
    amount,
    currency,
  };
});
