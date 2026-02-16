import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { requireAuth } from "./auth";
import { recomputeScoresCore } from "./scoring";

const REGION = "asia-southeast1";
const TRANSFER_WINDOW_DOC = "transferWindow";
const TRANSFER_SCORING_VERSION = "v2-tiered-cost";

// Tiered transfer cost system
const BASE_COST = 10;
const UPGRADE_MULTIPLIER = 15; // Cost per tier when upgrading to better team
const DOWNGRADE_DISCOUNT = 3; // Discount per tier when downgrading
const MINIMUM_COST = 5; // Floor for any transfer

type PortfolioRole = "featured" | "drawn";
type PortfolioItem = { teamId: string; role: PortfolioRole };

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const normalized = Math.floor(value);
  return normalized < 0 ? 0 : normalized;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function asTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

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

function isTransferWindowOpen(config: any, nowMs: number): boolean {
  if (!config || config.enabled !== true) return false;

  const startsAt = asTimestampMs(config.startsAt);
  const endsAt = asTimestampMs(config.endsAt);

  if (startsAt !== null && nowMs < startsAt) return false;
  if (endsAt !== null && nowMs > endsAt) return false;

  return true;
}

function calculateTransferCost(dropTier: number, pickupTier: number): number {
  // Normalize tiers to valid range (1-5)
  const normalizedDropTier = Math.max(1, Math.min(5, Math.floor(dropTier)));
  const normalizedPickupTier = Math.max(1, Math.min(5, Math.floor(pickupTier)));

  // Calculate tier difference
  // Negative = upgrading (picking better tier, lower number)
  // Positive = downgrading (picking worse tier, higher number)
  const tierDifference = normalizedPickupTier - normalizedDropTier;

  let tierPenalty = 0;

  if (tierDifference < 0) {
    // UPGRADING: Expensive (penalize)
    tierPenalty = Math.abs(tierDifference) * UPGRADE_MULTIPLIER;
  } else if (tierDifference > 0) {
    // DOWNGRADING: Cheap (reward)
    tierPenalty = -(tierDifference * DOWNGRADE_DISCOUNT);
  }
  // else: LATERAL (same tier) - no penalty

  // Apply minimum cost floor
  return Math.max(MINIMUM_COST, BASE_COST + tierPenalty);
}

function getSquadFromUser(userData: any): {
  featuredTeamId: string | null;
  drawnTeamIds: string[];
} {
  const portfolio: Array<{ teamId?: unknown; role?: unknown }> = Array.isArray(
    userData?.portfolio
  )
    ? userData.portfolio
    : [];

  const portfolioFeaturedTeamId = asString(
    portfolio.find((item) => item?.role === "featured")?.teamId
  );
  const portfolioDrawnTeamIds = portfolio
    .filter((item) => item?.role === "drawn")
    .map((item) => asString(item?.teamId))
    .filter(Boolean) as string[];

  const entryFeaturedTeamId = asString(userData?.entry?.featuredTeamId);
  const entryDrawnTeamIds = Array.isArray(userData?.entry?.drawnTeamIds)
    ? userData.entry.drawnTeamIds
        .map((teamId: unknown) => asString(teamId))
        .filter(Boolean) as string[]
    : [];

  const featuredTeamId = entryFeaturedTeamId ?? portfolioFeaturedTeamId ?? null;
  const drawnTeamIds = uniq([...entryDrawnTeamIds, ...portfolioDrawnTeamIds]).slice(
    0,
    5
  );

  return { featuredTeamId, drawnTeamIds };
}

export const executeTransfer = onCall({ region: REGION }, async (request) => {
  const auth = requireAuth(request);
  const uid = auth.uid;
  const dropTeamId = asString(request.data?.dropTeamId);
  const pickupTeamId = asString(request.data?.pickupTeamId);

  if (!dropTeamId || !pickupTeamId) {
    throw new HttpsError(
      "invalid-argument",
      "dropTeamId and pickupTeamId are required."
    );
  }

  if (dropTeamId === pickupTeamId) {
    throw new HttpsError(
      "invalid-argument",
      "dropTeamId and pickupTeamId must be different."
    );
  }

  const nowMs = Date.now();
  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const dropTeamRef = db.collection("teams").doc(dropTeamId);
  const pickupTeamRef = db.collection("teams").doc(pickupTeamId);
  const transferWindowRef = db.collection("settings").doc(TRANSFER_WINDOW_DOC);
  const transferEventRef = db.collection("transferEvents").doc();

  const result = await db.runTransaction(async (tx) => {
    const [userSnap, dropTeamSnap, pickupTeamSnap, transferWindowSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(dropTeamRef),
      tx.get(pickupTeamRef),
      tx.get(transferWindowRef),
    ]);

    if (!userSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "User profile is missing. Sign out and sign in again."
      );
    }

    if (!dropTeamSnap.exists) {
      throw new HttpsError("not-found", "Drop team does not exist.");
    }

    if (!pickupTeamSnap.exists) {
      throw new HttpsError("not-found", "Pickup team does not exist.");
    }

    // Get team tiers for cost calculation
    const dropTeamData = dropTeamSnap.data() as any;
    const pickupTeamData = pickupTeamSnap.data() as any;
    const dropTier = typeof dropTeamData?.tier === "number" ? dropTeamData.tier : 3;
    const pickupTier = typeof pickupTeamData?.tier === "number" ? pickupTeamData.tier : 3;

    // Calculate transfer cost based on tier difference
    const transferCost = calculateTransferCost(dropTier, pickupTier);

    const transferWindowData = transferWindowSnap.exists
      ? transferWindowSnap.data()
      : null;

    if (!isTransferWindowOpen(transferWindowData, nowMs)) {
      throw new HttpsError(
        "failed-precondition",
        "Transfer window is closed."
      );
    }

    const userData = userSnap.data() as any;
    const { featuredTeamId, drawnTeamIds } = getSquadFromUser(userData);

    if (!featuredTeamId || drawnTeamIds.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "You must complete team selection before transferring."
      );
    }

    if (dropTeamId === featuredTeamId) {
      throw new HttpsError(
        "failed-precondition",
        "Featured team cannot be transferred."
      );
    }

    const dropIndex = drawnTeamIds.indexOf(dropTeamId);
    if (dropIndex < 0) {
      throw new HttpsError(
        "failed-precondition",
        "You can only drop one of your drawn teams."
      );
    }

    const squadTeamIds = new Set([featuredTeamId, ...drawnTeamIds]);
    if (squadTeamIds.has(pickupTeamId)) {
      throw new HttpsError(
        "failed-precondition",
        "Pickup team is already in your squad."
      );
    }

    const remainingTransfersBefore = asNonNegativeInteger(
      userData?.remainingTransfers
    );
    if (remainingTransfersBefore <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "No transfers remaining."
      );
    }

    const nextDrawnTeamIds = [...drawnTeamIds];
    nextDrawnTeamIds[dropIndex] = pickupTeamId;

    if (new Set(nextDrawnTeamIds).size !== nextDrawnTeamIds.length) {
      throw new HttpsError(
        "failed-precondition",
        "Invalid transfer: duplicate team in drawn squad."
      );
    }

    const nextPortfolio: PortfolioItem[] = [
      { teamId: featuredTeamId, role: "featured" },
      ...nextDrawnTeamIds.map((teamId) => ({ teamId, role: "drawn" as const })),
    ];

    const remainingTransfersAfter = remainingTransfersBefore - 1;
    const existingEntry =
      userData?.entry && typeof userData.entry === "object" ? userData.entry : {};

    tx.set(
      userRef,
      {
        portfolio: nextPortfolio,
        entry: {
          ...existingEntry,
          featuredTeamId,
          drawnTeamIds: nextDrawnTeamIds,
        },
        remainingTransfers: remainingTransfersAfter,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(transferEventRef, {
      uid,
      dropTeamId,
      pickupTeamId,
      dropTier,
      pickupTier,
      remainingTransfersBefore,
      remainingTransfersAfter,
      scoringPenaltyApplied: true,
      scoringPenaltyPoints: transferCost,
      scoringPenaltyVersion: TRANSFER_SCORING_VERSION,
      createdAt: FieldValue.serverTimestamp(),
      source: "executeTransfer",
    });

    return {
      remainingTransfers: remainingTransfersAfter,
      featuredTeamId,
      drawnTeamIds: nextDrawnTeamIds,
      transferEventId: transferEventRef.id,
      transferCost,
      dropTier,
      pickupTier,
    };
  });

  let leaderboardRecomputed = false;
  try {
    await recomputeScoresCore({
      includeLive: true,
      scoringVersion: "v1",
      initiatedBy: uid,
    });
    leaderboardRecomputed = true;
  } catch (err) {
    console.error("[transfer] recompute after transfer failed:", err);
  }

  return {
    ok: true,
    transferPenaltyPoints: result.transferCost,
    scoringPenaltyVersion: TRANSFER_SCORING_VERSION,
    leaderboardRecomputed,
    ...result,
  };
});
