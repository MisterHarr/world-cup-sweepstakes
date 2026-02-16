import { useState, useCallback } from "react";

/**
 * Optimistic update utilities
 * Provides instant UI feedback while backend operations complete
 */

export type OptimisticState<T> = {
  data: T | null;
  isPending: boolean;
  error: Error | null;
};

export type OptimisticUpdateOptions<T, R> = {
  // Current data value
  currentData: T | null;
  // Optimistic data to show immediately
  optimisticData: T;
  // Async operation to perform
  operation: () => Promise<R>;
  // Called on success with backend result
  onSuccess?: (result: R) => void;
  // Called on error
  onError?: (error: Error) => void;
  // Called on completion (success or error)
  onComplete?: () => void;
};

/**
 * Hook for managing optimistic updates
 * Shows optimistic data immediately, rolls back on error
 */
export function useOptimisticUpdate<T>() {
  const [state, setState] = useState<OptimisticState<T>>({
    data: null,
    isPending: false,
    error: null,
  });

  const execute = useCallback(
    async <R,>(options: OptimisticUpdateOptions<T, R>) => {
      const {
        currentData,
        optimisticData,
        operation,
        onSuccess,
        onError,
        onComplete,
      } = options;

      // Immediately show optimistic data
      setState({
        data: optimisticData,
        isPending: true,
        error: null,
      });

      try {
        // Execute actual operation
        const result = await operation();

        // Success: keep optimistic data, clear pending
        setState({
          data: optimisticData,
          isPending: false,
          error: null,
        });

        onSuccess?.(result);
        return result;
      } catch (error) {
        // Error: rollback to previous data
        const err = error instanceof Error ? error : new Error(String(error));

        setState({
          data: currentData,
          isPending: false,
          error: err,
        });

        onError?.(err);
        throw error;
      } finally {
        onComplete?.();
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      isPending: false,
      error: null,
    });
  }, []);

  return {
    state,
    execute,
    reset,
  };
}

/**
 * Simple optimistic update wrapper for inline use
 * Returns [optimisticData, actualData, isPending, error]
 */
export async function performOptimisticUpdate<T, R>(
  optimisticValue: T,
  operation: () => Promise<R>,
  onRollback?: (error: Error) => void
): Promise<R> {
  try {
    return await operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onRollback?.(err);
    throw error;
  }
}
