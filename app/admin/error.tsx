"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Admin route error boundary
 * Catches errors specific to admin pages
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Admin error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <div className="mb-4 text-3xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-white">
          Admin page error
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          An error occurred while loading this admin page.
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
            Try Again
          </Button>
          <Button
            onClick={() => (window.location.href = "/admin")}
            variant="outline"
            className="flex-1"
          >
            Back to Admin
          </Button>
        </div>
      </div>
    </div>
  );
}
