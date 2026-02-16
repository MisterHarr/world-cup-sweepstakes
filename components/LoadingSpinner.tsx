import { Loader2 } from "lucide-react";

/**
 * Loading spinner component
 * Reusable spinner for async operations
 */
export function LoadingSpinner({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <Loader2
      className={`animate-spin ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Full-page loading screen
 */
export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-950"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4 text-slate-400" />
        <p className="text-sm text-slate-400">
          {message || "Loading..."}
        </p>
      </div>
    </div>
  );
}

/**
 * Inline loading indicator
 */
export function InlineLoading({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <LoadingSpinner size="sm" />
      <span>{message || "Loading..."}</span>
    </div>
  );
}
