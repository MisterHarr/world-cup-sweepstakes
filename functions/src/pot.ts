/**
 * Prize Pot — Cloud Functions
 *
 * confirmPotEntry  (admin-only)
 *   Transitions a potEntries/{uid} doc to "confirmed".
 *   Works whether the player has self-declared (pending doc exists) or not.
 *   Idempotent — safe to call twice.
 *
 * removePotEntry  (admin-only)
 *   Deletes a potEntries/{uid} doc entirely.
 *   Use for fraudulent self-declarations or to undo a mistaken confirmation.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { requireAdmin } from "./auth";
import { CALL_OPTS } from "./runtimeConfig";

const db = () => admin.firestore();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// ── confirmPotEntry ───────────────────────────────────────────────────────────

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

  // Resolve display name from users/{uid}
  const userSnap = await db().collection("users").doc(targetUid).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", `User ${targetUid} not found.`);
  }
  const userData = userSnap.data() as { displayName?: string };
  const displayName =
    typeof userData.displayName === "string" && userData.displayName.trim()
      ? userData.displayName.trim()
      : targetUid;

  // merge: true preserves self-declaration fields (code, selfDeclaredAt) if present.
  // eligibleForPot is set here and ONLY here — no client path can set this field
  // (rules allow create with a fixed field list that excludes it; update is denied).
  await db()
    .collection("potEntries")
    .doc(targetUid)
    .set(
      {
        uid: targetUid,
        displayName,
        status: "confirmed",
        eligibleForPot: true,
        amount,
        currency,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
        confirmedBy: adminAuth.uid,
        note,
      },
      { merge: true }
    );

  return { ok: true, uid: targetUid, displayName, amount, currency };
});

// ── exportConfirmedEntrants ───────────────────────────────────────────────────

/**
 * Returns a snapshot of all confirmed, prize-eligible pot entries.
 * Admin-only. Used to lock the payout list before scoring begins.
 */
export const exportConfirmedEntrants = onCall(CALL_OPTS, async (request) => {
  requireAdmin(request);

  const snap = await db()
    .collection("potEntries")
    .where("status", "==", "confirmed")
    .orderBy("confirmedAt", "asc")
    .get();

  const rows = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      uid:         String(data.uid ?? d.id),
      displayName: typeof data.displayName === "string" ? data.displayName : "—",
      code:        typeof data.code === "string" ? data.code : null,
      amount:      typeof data.amount === "number" ? data.amount : null,
      currency:    typeof data.currency === "string" ? data.currency : null,
      confirmedAt: isRecord(data.confirmedAt)
        ? (data.confirmedAt as { seconds: number }).seconds
        : null,
    };
  });

  return { ok: true, count: rows.length, rows };
});

// ── adminSetPotPaymentStatus ──────────────────────────────────────────────────

/**
 * Admin-only. Records whether a player has paid cash or opted out.
 * Writes `potPaymentStatus` to users/{uid}. Passing "pending" clears the field.
 * No money moves through the site — this is a manual tracking record only.
 */
export const adminSetPotPaymentStatus = onCall(CALL_OPTS, async (request) => {
  requireAdmin(request);

  const payload = isRecord(request.data) ? request.data : {};
  const targetUid = typeof payload.uid === "string" ? payload.uid.trim() : "";
  const status = payload.status;

  if (!targetUid) throw new HttpsError("invalid-argument", "Missing uid.");
  if (status !== "paid" && status !== "opted_out" && status !== "pending") {
    throw new HttpsError(
      "invalid-argument",
      "status must be 'paid', 'opted_out', or 'pending'."
    );
  }

  const userRef = db().collection("users").doc(targetUid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError("not-found", `User ${targetUid} not found.`);

  if (status === "pending") {
    await userRef.update({
      potPaymentStatus: admin.firestore.FieldValue.delete(),
      potPaymentStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await userRef.update({
      potPaymentStatus: status,
      potPaymentStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { ok: true, uid: targetUid, status };
});

// ── removePotEntry ────────────────────────────────────────────────────────────

export const removePotEntry = onCall(CALL_OPTS, async (request) => {
  requireAdmin(request);

  const payload = isRecord(request.data) ? request.data : {};
  const targetUid =
    typeof payload.uid === "string" ? payload.uid.trim() : "";

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Missing uid.");
  }

  await db().collection("potEntries").doc(targetUid).delete();

  return { ok: true, uid: targetUid };
});
