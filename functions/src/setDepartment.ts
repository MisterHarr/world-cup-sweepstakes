import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

if (!admin.apps.length) {
  admin.initializeApp();
}

const REGION = "asia-southeast1";
const ALLOWED = ["Primary", "Secondary", "Admin"] as const;

type Dept = (typeof ALLOWED)[number];

export const setDepartment = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const department = (request.data?.department ?? null) as Dept | null;
  if (!department || !ALLOWED.includes(department)) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid department. Use Primary, Secondary, or Admin."
    );
  }

  const isAdmin = request.auth?.token?.admin === true;

  const userRef = admin.firestore().doc(`users/${uid}`);
  const snap = await userRef.get();
  const existingDept = (snap.exists ? (snap.data() as any)?.department : null) as
    | Dept
    | null;

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
