/**
 * Conditional logging utility for Cloud Functions
 * Prevents sensitive information leakage in production logs
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Safe console.log replacement for Cloud Functions
 * Only logs detailed info in development
 */
export function devLog(...args: unknown[]): void {
  if (isDevelopment) {
    console.log(...args);
  }
}

/**
 * Safe console.warn replacement for Cloud Functions
 * Only logs detailed warnings in development
 */
export function devWarn(...args: unknown[]): void {
  if (isDevelopment) {
    console.warn(...args);
  }
}

/**
 * Safe error logging for Cloud Functions
 * Logs error type and code without exposing sensitive details
 */
export function logError(context: string, error: unknown): void {
  const metadata = getErrorMetadata(error);

  // Always log the context and error type for debugging
  console.error(`[${context}] Error:`, {
    type: metadata.type,
    code: metadata.code,
    // Only include message in development
    ...(isDevelopment && metadata.message ? { message: metadata.message } : {}),
  });
}

/**
 * Extract safe error metadata without sensitive details
 */
function getErrorMetadata(error: unknown): {
  type: string;
  code?: string;
  message?: string;
} {
  if (error instanceof Error) {
    return {
      type: error.name,
      code: (error as { code?: string }).code,
      message: error.message,
    };
  }

  return {
    type: "UnknownError",
    message: String(error),
  };
}

/**
 * Create user-facing error message
 * Returns generic message in production, detailed in development
 */
export function createUserError(error: unknown, fallback: string): string {
  if (isDevelopment && error instanceof Error) {
    return error.message;
  }
  return fallback;
}
