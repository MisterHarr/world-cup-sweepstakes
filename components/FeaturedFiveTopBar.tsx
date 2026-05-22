"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function initialsForChrome(
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const n = (displayName ?? "").trim();
  if (n.length > 0) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0];
      const b = parts[parts.length - 1][0];
      if (a && b) return `${a}${b}`.toUpperCase();
    }
    if (parts.length === 1) {
      const w = parts[0];
      if (w.length >= 2) return w.slice(0, 2).toUpperCase();
      if (w[0]) return `${w[0]}?`.toUpperCase();
    }
  }
  const e = (email ?? "").trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return "?";
}

export type FeaturedFiveTopBarProps = {
  /** Left cluster — typically `AppBrandBlock` with `variant="ff-chrome"`. */
  brand: ReactNode;
  /** Shown in the live-status pill (defaults to 0). */
  liveCount?: number;
  userDisplayName?: string | null;
  userEmail?: string | null;
  /** When false, the initials tile is omitted (e.g. signed-out marketing shell). */
  showUserTile?: boolean;
  /** e.g. Sign out control */
  trailing?: ReactNode;
  className?: string;
};

export function FeaturedFiveTopBar({
  brand,
  liveCount = 0,
  userDisplayName,
  userEmail,
  showUserTile = true,
  trailing,
  className,
}: FeaturedFiveTopBarProps) {
  const count = Number.isFinite(liveCount) ? Math.max(0, Math.floor(liveCount)) : 0;
  const initials = initialsForChrome(userDisplayName, userEmail);
  const signedLabel =
    (userDisplayName ?? "").trim() ||
    (userEmail ?? "").trim() ||
    "Signed out";

  return (
    <div
      className={cn(
        "font-ff-ui flex h-[50px] w-full items-center justify-between gap-2 sm:gap-3",
        className
      )}
    >
      <div className="min-w-0 flex-1">{brand}</div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div
          className="flex items-center gap-1.5 rounded-full border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.08)] px-2.5 py-1 text-[11px] font-medium tabular-nums text-[var(--ff-fg-secondary)]"
          role="status"
          aria-live="polite"
          aria-label={`${count} live match${count === 1 ? "" : "es"}`}
        >
          <span
            className={cn(
              "inline-block size-[6px] shrink-0 rounded-full bg-[var(--ff-danger)]",
              count > 0 && "ff-live-dot"
            )}
            aria-hidden
          />
          <span className="text-[11px] leading-none">{count} Live</span>
        </div>

        {showUserTile ? (
          <div
            className="flex size-[26px] shrink-0 items-center justify-center rounded-[6px] border border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] font-ff-display text-[10px] font-bold uppercase leading-none tracking-wide text-[var(--ff-accent-text)]"
            aria-label={
              signedLabel === "Signed out" ? "Signed out" : `Account: ${signedLabel}`
            }
            title={signedLabel}
          >
            {initials}
          </div>
        ) : null}

        {trailing ? <div className="flex items-center gap-1.5">{trailing}</div> : null}
      </div>
    </div>
  );
}
