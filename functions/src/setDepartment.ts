import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

if (!admin.apps.length) {
  admin.initializeApp();
}

import { CALL_OPTS } from "./runtimeConfig";
const ALLOWED = ["Primary", "Secondary", "Admin"] as const;

type Dept = (typeof ALLOWED)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asDept(value: unknown): Dept | null {
  return value === "Primary" || value === "Secondary" || value === "Admin"
    ? value
    : null;
}

export const setDepartment = onCall(CALL_OPTS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const payload = isRecord(request.data) ? request.data : {};
  const department = asDept(payload.department);
  if (!department || !ALLOWED.includes(department)) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid department. Use Primary, Secondary, or Admin."
    );
  }

  const isAdmin = request.auth?.token?.admin === true;

  const userRef = admin.firestore().doc(`users/${uid}`);
  const snap = await userRef.get();
  const existing = snap.exists
    ? (snap.data() as Record<string, unknown>)
    : {};
  const existingDept = asDept(existing.department);

  // If already set, only admin can change it
  if (existingDept && !isAdmin) {
    throw new HttpsError(
      "permission-denied",
      "Department is already set and cannot be changed."
    );
  }

  await userRef.set(
    {
      department,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    department,
    alreadySet: Boolean(existingDept),
    changedByAdmin: Boolean(existingDept && isAdmin),
  };
});
