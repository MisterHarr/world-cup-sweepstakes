/**
 * Network retry utilities for handling transient failures
 * Implements exponential backoff with configurable attempts
 */

type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
};

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: () => true,
};

/**
 * Delays execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async operation with exponential backoff
 * @param operation Function to retry
 * @param options Retry configuration
 * @returns Result of successful operation
 * @throws Last error if all retries exhausted
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if shouldRetry returns false
      if (!config.shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );

      if (process.env.NODE_ENV === "development") {
        console.warn(
          `Retry attempt ${attempt}/${config.maxAttempts} after ${delayMs}ms`,
          error
        );
      }

      await delay(delayMs);
    }
  }

  throw lastError;
}

/**
 * Check if error is a network error that should be retried
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout") ||
      message.includes("offline") ||
      message.includes("unavailable") ||
      // Firestore errors
      message.includes("unavailable") ||
      message.includes("deadline-exceeded") ||
      // Firebase errors
      (error as any).code === "unavailable" ||
      (error as any).code === "deadline-exceeded"
    );
  }
  return false;
}

/**
 * Firestore-specific retry wrapper
 * Automatically retries on network/availability errors
 */
export async function retryFirestoreOperation<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retryWithBackoff(operation, {
    maxAttempts,
    initialDelayMs: 1000,
    maxDelayMs: 4000,
    backoffMultiplier: 2,
    shouldRetry: isNetworkError,
  });
}

/**
 * Cloud Function call retry wrapper
 * Automatically retries on network errors and specific Firebase error codes
 */
export async function retryCloudFunction<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 2
): Promise<T> {
  return retryWithBackoff(operation, {
    maxAttempts,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // Retry on network errors
      if (isNetworkError(error)) return true;

      // Don't retry on auth or validation errors
      if (error && typeof error === "object") {
        const code = (error as any).code;
        if (
          code === "unauthenticated" ||
          code === "permission-denied" ||
          code === "invalid-argument" ||
          code === "failed-precondition" ||
          code === "not-found" ||
          code === "resource-exhausted"
        ) {
          return false;
        }
      }

      return true;
    },
  });
}

/**
 * Manual retry state hook for UI components
 */
export type RetryState = {
  isRetrying: boolean;
  retryCount: number;
  lastError: Error | null;
};

export function createRetryState(): RetryState {
  return {
    isRetrying: false,
    retryCount: 0,
    lastError: null,
  };
}
