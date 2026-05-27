import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";
import { requireAuth } from "./auth";
import { CALL_OPTS } from "./runtimeConfig";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type TransferHistoryRow = {
  id: string;
  dropTeamId: string | null;
  pickupTeamId: string | null;
  dropTeamName: string | null;
  pickupTeamName: string | null;
  dropTier: number | null;
  pickupTier: number | null;
  scoringPenaltyPoints: number;
  remainingTransfersBefore: number | null;
  remainingTransfersAfter: number | null;
  createdAtMs: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asNonNegativeInteger(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  const normalized = Math.floor(parsed);
  return normalized < 0 ? 0 : normalized;
}

function asTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function resolveLimit(data: unknown): number {
  if (!isRecord(data)) return DEFAULT_LIMIT;
  const raw = asNumber(data.limit);
  if (raw === null) return DEFAULT_LIMIT;
  const normalized = Math.floor(raw);
  if (normalized < 1) return 1;
  if (normalized > MAX_LIMIT) return MAX_LIMIT;
  return normalized;
}

export const getTransferHistory = onCall(CALL_OPTS, async (request) => {
  const auth = requireAuth(request);
  const uid = auth.uid;
  const limit = resolveLimit(request.data);

  const db = admin.firestore();
  const transferSnap = await db
    .collection("transferEvents")
    .where("uid", "==", uid)
    .limit(limit)
    .get();

  const rows = transferSnap.docs.map((transferDoc): TransferHistoryRow => {
    const data = transferDoc.data() as Record<string, unknown>;
    const dropTeamId = asString(data.dropTeamId);
    const pickupTeamId = asString(data.pickupTeamId);
    const createdAtMs =
      asTimestampMs(data.createdAtMs) ?? asTimestampMs(data.createdAt);

    return {
      id: transferDoc.id,
      dropTeamId,
      pickupTeamId,
      dropTeamName: asString(data.dropTeamName),
      pickupTeamName: asString(data.pickupTeamName),
      dropTier: asNonNegativeInteger(data.dropTier),
      pickupTier: asNonNegativeInteger(data.pickupTier),
      scoringPenaltyPoints: asNumber(data.scoringPenaltyPoints) ?? 0,
      remainingTransfersBefore: asNonNegativeInteger(
        data.remainingTransfersBefore
      ),
      remainingTransfersAfter: asNonNegativeInteger(data.remainingTransfersAfter),
      createdAtMs,
    };
  });

  const missingTeamIds = Array.from(
    new Set(
      rows.flatMap((row) => {
        const ids: string[] = [];
        if (!row.dropTeamName && row.dropTeamId) ids.push(row.dropTeamId);
        if (!row.pickupTeamName && row.pickupTeamId) ids.push(row.pickupTeamId);
        return ids;
      })
    )
  );

  const missingNamesById: Record<string, string> = {};
  if (missingTeamIds.length > 0) {
    const teamSnaps = await Promise.all(
      missingTeamIds.map((teamId) => db.collection("teams").doc(teamId).get())
    );

    teamSnaps.forEach((teamSnap) => {
      if (!teamSnap.exists) return;
      const data = teamSnap.data() as Record<string, unknown> | undefined;
      const name = asString(data?.name);
      if (!name) return;
      missingNamesById[teamSnap.id] = name;
    });
  }

  const hydratedRows = rows
    .map((row) => ({
      ...row,
      dropTeamName:
        row.dropTeamName ??
        (row.dropTeamId ? missingNamesById[row.dropTeamId] ?? null : null),
      pickupTeamName:
        row.pickupTeamName ??
        (row.pickupTeamId ? missingNamesById[row.pickupTeamId] ?? null : null),
    }))
    .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
    .slice(0, limit);

  return {
    ok: true,
    rows: hydratedRows,
  };
});
