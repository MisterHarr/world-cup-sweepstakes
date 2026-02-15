import { HttpsError } from "firebase-functions/v2/https";

/**
 * Simple in-memory rate limiter for Cloud Functions
 * Tracks requests per user ID with configurable time windows
 *
 * PRODUCTION NOTE: For multi-instance deployments, consider Redis or Firestore-based limiter
 * This implementation is suitable for single-region deployments with moderate traffic
 */

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

type RequestLog = {
  count: number;
  firstRequestMs: number;
};

// In-memory store: uid -> RequestLog
const requestStore = new Map<string, RequestLog>();

// Cleanup interval: remove stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupTimer() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [uid, log] of requestStore.entries()) {
      // Remove entries older than 1 hour
      if (now - log.firstRequestMs > 60 * 60 * 1000) {
        requestStore.delete(uid);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Rate limit check for a user
 * @param uid User ID
 * @param config Rate limit configuration
 * @throws HttpsError with code 'resource-exhausted' if limit exceeded
 */
export function checkRateLimit(uid: string, config: RateLimitConfig): void {
  startCleanupTimer();

  const now = Date.now();
  const existing = requestStore.get(uid);

  if (!existing) {
    // First request in window
    requestStore.set(uid, {
      count: 1,
      firstRequestMs: now,
    });
    return;
  }

  const elapsedMs = now - existing.firstRequestMs;

  if (elapsedMs > config.windowMs) {
    // Window expired, reset
    requestStore.set(uid, {
      count: 1,
      firstRequestMs: now,
    });
    return;
  }

  // Within window
  if (existing.count >= config.maxRequests) {
    const remainingMs = config.windowMs - elapsedMs;
    const remainingSec = Math.ceil(remainingMs / 1000);

    throw new HttpsError(
      "resource-exhausted",
      `Rate limit exceeded. Try again in ${remainingSec} seconds.`
    );
  }

  // Increment count
  existing.count += 1;
  requestStore.set(uid, existing);
}

/**
 * Pre-configured rate limiters for common operations
 */
export const RateLimits = {
  // Transfers: max 5 requests per minute (prevents spam clicking)
  transfer: { maxRequests: 5, windowMs: 60 * 1000 },

  // Featured team selection: max 10 requests per minute (prevents rapid changes)
  featuredTeam: { maxRequests: 10, windowMs: 60 * 1000 },

  // Department selection: max 3 requests per hour (rarely needs to be changed)
  department: { maxRequests: 3, windowMs: 60 * 60 * 1000 },

  // Admin operations: max 20 requests per minute
  admin: { maxRequests: 20, windowMs: 60 * 1000 },
};
