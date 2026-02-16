"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Top-level error boundary for the entire application
 * Catches errors in app router pages and provides fallback UI
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("App-level error:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
          <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="mb-2 text-xl font-semibold text-white">
              Something went wrong
            </h1>
            <p className="mb-4 text-sm text-slate-400">
              An unexpected error occurred. Please try reloading the page.
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
                onClick={() => (window.location.href = "/dashboard")}
                variant="outline"
                className="flex-1"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
