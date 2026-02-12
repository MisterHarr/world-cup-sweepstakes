import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

type LeaderboardRow = {
  id: string;
  displayName: string;
  department: "Primary" | "Secondary" | "Admin" | null;
};

export const getLeaderboard = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const rawLimit = (request.data?.limit ?? 200) as number;
    const safeLimit = Math.max(1, Math.min(500, Number(rawLimit) || 200));

    try {
      const snap = await admin
        .firestore()
        .collection("users")
        .orderBy("displayName")
        .limit(safeLimit)
        .get();

      const rows: LeaderboardRow[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const displayName =
          typeof data?.displayName === "string" && data.displayName.trim()
            ? data.displayName.trim()
            : "Anonymous";

        const department =
          data?.department === "Primary" ||
          data?.department === "Secondary" ||
          data?.department === "Admin"
            ? data.department
            : null;

        return {
          id: d.id,
          displayName,
          department,
        };
      });

      return { ok: true, rows };
    } catch (err: any) {
      console.error("getLeaderboard failed:", err);
      throw new HttpsError(
        "internal",
        err?.message ?? "Failed to load leaderboard."
      );
    }
  }
);
