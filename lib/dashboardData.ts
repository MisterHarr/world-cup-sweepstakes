import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  documentId,
} from "firebase/firestore";
import type { User, Team } from "@/types";

/**
 * Fetch the logged-in user's Firestore document
 */
export async function fetchUserDoc(uid: string): Promise<User | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return snap.data() as User;
}

/**
 * Resolve an array of teamIds into a map of teamId -> Team
 * Handles Firestore "in" query limits safely.
 */
export async function fetchTeamsByIds(
  teamIds: string[]
): Promise<Record<string, Team>> {
  if (!teamIds.length) return {};

  const result: Record<string, Team> = {};

  // Firestore "in" query limit = 10
  const chunks: string[][] = [];
  for (let i = 0; i < teamIds.length; i += 10) {
    chunks.push(teamIds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const q = query(collection(db, "teams"), where(documentId(), "in", chunk));
    const snap = await getDocs(q);

    snap.forEach((docSnap) => {
      result[docSnap.id] = docSnap.data() as Team;
    });
  }

  return result;
}
