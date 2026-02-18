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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asDepartment(value: unknown): "Primary" | "Secondary" | "Admin" | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (token === "primary") return "Primary";
  if (token === "secondary") return "Secondary";
  if (
    token === "admin" ||
    token === "opsadmin" ||
    token === "operationsadmin" ||
    token === "ops" ||
    token === "operations"
  ) {
    return "Admin";
  }
  return null;
}

export const getLeaderboard = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const payload = isRecord(request.data) ? request.data : {};
    const rawLimit = Number(payload.limit ?? 200);
    const safeLimit = Math.max(1, Math.min(500, Number(rawLimit) || 200));

    try {
      const snap = await admin
        .firestore()
        .collection("users")
        .orderBy("displayName")
        .limit(safeLimit)
        .get();

      const rows: LeaderboardRow[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const displayName =
          typeof data.displayName === "string" && data.displayName.trim()
            ? data.displayName.trim()
            : "Anonymous";

        const department = asDepartment(data.department);

        return {
          id: d.id,
          displayName,
          department,
        };
      });

      return { ok: true, rows };
    } catch (err: unknown) {
      console.error("getLeaderboard failed:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string" && err.trim().length > 0
            ? err
            : "Failed to load leaderboard.";
      throw new HttpsError(
        "internal",
        message
      );
    }
  }
);
