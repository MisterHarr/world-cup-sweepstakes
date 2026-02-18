// lib/userBootstrap.ts
import { db, functions } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

function readErrorCode(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const maybeCode = (err as { code?: unknown }).code;
  if (typeof maybeCode === "string") return maybeCode.toLowerCase();
  return "";
}

function shouldFallbackToClientWrite(err: unknown): boolean {
  const code = readErrorCode(err);
  return (
    code === "not-found" ||
    code === "functions/not-found" ||
    code === "unavailable" ||
    code === "functions/unavailable" ||
    code === "internal" ||
    code === "functions/internal"
  );
}

function isPermissionDenied(err: unknown): boolean {
  const code = readErrorCode(err);
  return code === "permission-denied" || code === "functions/permission-denied";
}

export async function ensureUserDoc(params: {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}) {
  const { uid, displayName, email, photoURL } = params;

  try {
    const ensureUserProfile = httpsCallable(functions, "ensureUserProfile");
    const res = await ensureUserProfile({
      displayName,
      email,
      photoURL: photoURL ?? null,
    });
    const payload = (res?.data ?? {}) as { created?: boolean };
    return { created: payload.created === true };
  } catch (err) {
    if (!shouldFallbackToClientWrite(err)) {
      throw err;
    }
  }

  const ref = doc(db, "users", uid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const fullCreatePayload = {
        uid,
        displayName: displayName || "Anonymous",
        email: email || "",
        photoURL: photoURL ?? null,
        portfolio: [],
        totalScore: 0,
        remainingTransfers: 2,
        transferPenaltyPoints: 0,
        isAdmin: false,
        hasSeenReveal: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        ref,
        fullCreatePayload,
        { merge: true }
      );
      return { created: true };
    }

    const existing = snap.data() as Record<string, unknown>;
    const profilePatch: Record<string, unknown> = {
      displayName: displayName || "Anonymous",
      email: email || "",
      photoURL: photoURL ?? null,
      updatedAt: serverTimestamp(),
    };
    if (typeof existing.uid !== "string" || existing.uid !== uid) {
      profilePatch.uid = uid;
    }
    if (typeof existing.remainingTransfers !== "number") {
      profilePatch.remainingTransfers = 2;
    }
    if (typeof existing.totalScore !== "number") {
      profilePatch.totalScore = 0;
    }
    if (typeof existing.transferPenaltyPoints !== "number") {
      profilePatch.transferPenaltyPoints = 0;
    }
    if (typeof existing.isAdmin !== "boolean") {
      profilePatch.isAdmin = false;
    }
    if (!Array.isArray(existing.portfolio)) {
      profilePatch.portfolio = [];
    }
    if (typeof existing.hasSeenReveal !== "boolean") {
      profilePatch.hasSeenReveal = false;
    }
    if (!existing.createdAt) {
      profilePatch.createdAt = serverTimestamp();
    }

    await setDoc(
      ref,
      profilePatch,
      { merge: true }
    );
    return { created: false };
  } catch (fallbackErr) {
    if (isPermissionDenied(fallbackErr)) {
      try {
        await setDoc(
          ref,
          {
            uid,
            displayName: displayName || "Anonymous",
            email: email || "",
            photoURL: photoURL ?? null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (profileOnlyErr) {
        if (!isPermissionDenied(profileOnlyErr)) {
          throw profileOnlyErr;
        }
      }
      return { created: false };
    }
    throw fallbackErr;
  }
}
