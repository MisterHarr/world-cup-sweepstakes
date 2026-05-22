"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Error Boundary component for catching React errors
 * Prevents white screen of death and provides user-friendly fallback UI
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }

    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

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
            {process.env.NODE_ENV === "development" && (
              <details className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-left text-xs">
                <summary className="cursor-pointer font-mono text-destructive">
                  Error Details (dev only)
                </summary>
                <pre className="mt-2 overflow-auto text-foreground">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <Button onClick={this.reset} variant="default" className="flex-1">
                Try Again
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

    return this.props.children;
  }
}

/**
 * Simple error fallback component for route-level boundaries
 */
export function RouteErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4 bg-background">
      <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center text-card-foreground shadow-lg">
        <div className="mb-3 flex justify-center text-destructive">
          <AlertTriangle className="size-10" strokeWidth={2} aria-hidden />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          Failed to load this section
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Something went wrong while loading this content.
        </p>
        {process.env.NODE_ENV === "development" && error.message ? (
          <p className="mb-4 text-left text-xs font-mono text-muted-foreground break-all">
            {error.message}
          </p>
        ) : null}
        <Button onClick={reset} variant="default" size="sm">
          Try Again
        </Button>
      </div>
    </div>
  );
}
