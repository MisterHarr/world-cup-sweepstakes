"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard route error boundary
 * Catches errors specific to the dashboard page
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Dashboard error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <div className="mb-4 text-3xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-white">
          Failed to load dashboard
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          We encountered an error while loading the dashboard. This could be due
          to a network issue or temporary problem.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <details className="mb-4 rounded border border-slate-700 bg-slate-950 p-3 text-left text-xs">
            <summary className="cursor-pointer font-mono text-red-400">
              Error Details (dev only)
            </summary>
            <pre className="mt-2 overflow-auto text-slate-300">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <Button onClick={reset} variant="default" className="flex-1">
            Retry
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex-1"
          >
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
}
