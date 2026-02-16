"use client";

import React from "react";
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
    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // Default fallback UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
          <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="mb-2 text-xl font-semibold text-white">
              Something went wrong
            </h1>
            <p className="mb-4 text-sm text-slate-400">
              An unexpected error occurred. Please try reloading the page.
            </p>
            {process.env.NODE_ENV === "development" && (
              <details className="mb-4 rounded border border-slate-700 bg-slate-950 p-3 text-left text-xs">
                <summary className="cursor-pointer font-mono text-red-400">
                  Error Details (dev only)
                </summary>
                <pre className="mt-2 overflow-auto text-slate-300">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <Button
                onClick={this.reset}
                variant="default"
                className="flex-1"
              >
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
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <div className="mb-3 text-3xl">⚠️</div>
        <h2 className="mb-2 text-lg font-semibold text-white">
          Failed to load this section
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Something went wrong while loading this content.
        </p>
        <Button onClick={reset} variant="default" size="sm">
          Try Again
        </Button>
      </div>
    </div>
  );
}
