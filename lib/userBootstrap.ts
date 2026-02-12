// lib/userBootstrap.ts
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { User } from "@/types";

export async function ensureUserDoc(params: {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}) {
  const { uid, displayName, email, photoURL } = params;

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  // Create on first login
  if (!snap.exists()) {
    const newUser: User = {
      uid,
      displayName: displayName || "Anonymous",
      email: email || "",
      photoURL: photoURL ?? undefined,

      // Game defaults
      portfolio: [],
      totalScore: 0,
      remainingTransfers: 3,
      isAdmin: false,
    };

    await setDoc(
      ref,
      {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as any,
      { merge: true }
    );

    return { created: true };
  }

  // If user doc exists, keep basic profile fresh (without overwriting game fields)
  await setDoc(
    ref,
    {
      displayName: displayName || "Anonymous",
      email: email || "",
      photoURL: photoURL ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { created: false };
}
