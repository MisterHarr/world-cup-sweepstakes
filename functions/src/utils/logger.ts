/**
 * Conditional logging utilities for Cloud Functions
 * Production-safe logging that sanitizes errors and prevents information leakage
 */

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Structured error type for safe logging
 */
type SafeError = {
  message: string;
  type?: string;
  code?: string;
};

/**
 * Sanitizes error objects for production logging
 * Removes stack traces and sensitive details
 */
export function sanitizeError(error: unknown): SafeError {
  if (error instanceof Error) {
    return {
      message: isDevelopment ? error.message : "An error occurred",
      type: error.constructor.name,
      code: (error as any).code,
    };
  }

  if (typeof error === "string") {
    return {
      message: isDevelopment ? error : "An error occurred",
    };
  }

  return {
    message: "An error occurred",
    type: typeof error,
  };
}

/**
 * Logs errors with context (production-safe)
 * @param context Operation context (e.g., "confirmFeaturedTeam", "executeTransfer")
 * @param error Error object or message
 */
export function logError(context: string, error: unknown): void {
  const safe = sanitizeError(error);

  if (isDevelopment) {
    console.error(`[${context}] Error:`, error);
  } else {
    // Production: log sanitized version only
    console.error(`[${context}] Error:`, safe);
  }
}

/**
 * Development-only logging
 * Strips all output in production builds
 */
export function devLog(...args: any[]): void {
  if (isDevelopment) {
    console.log(...args);
  }
}

export function devWarn(...args: any[]): void {
  if (isDevelopment) {
    console.warn(...args);
  }
}

export function devError(...args: any[]): void {
  if (isDevelopment) {
    console.error(...args);
  }
}
