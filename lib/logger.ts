/**
 * Conditional logging utility for production safety
 * Only outputs logs in development mode to prevent information leakage
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Safe console.log replacement
 * Only logs in development mode
 */
export function devLog(...args: unknown[]): void {
  if (isDevelopment) {
    console.log(...args);
  }
}

/**
 * Safe console.error replacement
 * Only logs in development mode
 * In production, errors should be sent to monitoring service
 */
export function devError(...args: unknown[]): void {
  if (isDevelopment) {
    console.error(...args);
  }
}

/**
 * Safe console.warn replacement
 * Only logs in development mode
 */
export function devWarn(...args: unknown[]): void {
  if (isDevelopment) {
    console.warn(...args);
  }
}

/**
 * Sanitize error for user display
 * Removes stack traces and sensitive details
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // In production, return generic message
    if (!isDevelopment) {
      return "An error occurred. Please try again later.";
    }
    // In development, return the actual message
    return error.message;
  }

  if (typeof error === "string") {
    return isDevelopment ? error : "An error occurred. Please try again later.";
  }

  return "An error occurred. Please try again later.";
}

/**
 * Extract safe error details for logging to monitoring service
 * Excludes sensitive information but keeps error type and code
 */
export function getErrorMetadata(error: unknown): {
  type: string;
  code?: string;
  message?: string;
} {
  if (error instanceof Error) {
    return {
      type: error.name,
      code: (error as { code?: string }).code,
      message: isDevelopment ? error.message : undefined,
    };
  }

  return {
    type: "UnknownError",
    message: isDevelopment ? String(error) : undefined,
  };
}
