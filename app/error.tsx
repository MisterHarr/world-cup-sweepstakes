"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

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
    if (process.env.NODE_ENV === "development") {
      console.error("App-level error:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center text-card-foreground shadow-lg">
        <div className="mb-4 flex justify-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="size-8" strokeWidth={2} aria-hidden />
          </div>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          An unexpected error occurred. Please try reloading the page.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <details className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-left text-xs">
            <summary className="cursor-pointer font-mono text-destructive">
              Error Details (dev only)
            </summary>
            <pre className="mt-2 overflow-auto text-foreground">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <Button onClick={reset} variant="default" className="flex-1">
            Try Again
          </Button>
          <Button
            onClick={() => {
              window.location.href = "/dashboard";
            }}
            variant="outline"
            className="flex-1"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
