/**
 * Shared Cloud Functions v2 runtime configuration.
 *
 * All functions import from here so memory/timeout values are defined once.
 * - CALL_OPTS:       standard callable functions (256 MiB, 30 s)
 * - HEAVY_CALL_OPTS: full-scan recompute + scheduled ingest (512 MiB, 120 s)
 */

export const REGION = "asia-southeast1" as const;

/** Standard callable functions — lightweight operations. */
export const CALL_OPTS = {
  region: REGION,
  memory: "256MiB",
  timeoutSeconds: 30,
} as const;

/**
 * Heavy callable / scheduled functions.
 * Covers recomputeScores, retryDirtyRecompute, recomputeShadowScores,
 * and ingestLiveScores — all perform full-collection scans at 150+ users.
 */
export const HEAVY_CALL_OPTS = {
  region: REGION,
  memory: "512MiB",
  timeoutSeconds: 120,
} as const;
