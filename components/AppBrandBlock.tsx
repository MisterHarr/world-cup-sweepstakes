"use client";

import { BRANDING } from "@/lib/branding";
import { cn } from "@/lib/utils";

type LogoTone = "glass" | "elevated";

const logoWrap: Record<LogoTone, string> = {
  // Logo already has its own dark background + rounded corners — keep container transparent
  glass:
    "w-10 h-10 rounded-xl overflow-hidden shrink-0",
  elevated:
    "w-10 h-10 rounded-xl overflow-hidden shrink-0",
};

type AppBrandBlockProps = {
  /** Primary heading (e.g. `BRANDING.appName` or `BRANDING.shortName`). */
  title: string;
  /** Optional second line (e.g. tagline on marketing-style shells). */
  tagline?: string;
  /** Visual style for the logo container. */
  logoTone?: LogoTone;
  /** Featured Five handoff chrome (26px emerald tile + display / UI type). */
  variant?: "standard" | "ff-chrome";
  className?: string;
};

/**
 * Shared logo + title block used by `AppShell` and the dashboard header so branding stays consistent.
 */
export function AppBrandBlock({
  title,
  tagline,
  logoTone = "glass",
  variant = "standard",
  className,
}: AppBrandBlockProps) {
  const isFfChrome = variant === "ff-chrome";

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5 sm:gap-3", className)}>
      {isFfChrome ? (
        <div className="size-[26px] shrink-0 overflow-hidden rounded-[6px]">
          <img
            src={BRANDING.logoSrc}
            alt={BRANDING.logoAlt}
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className={cn("shrink-0", logoWrap[logoTone])}>
          <img
            src={BRANDING.logoSrc}
            alt={BRANDING.logoAlt}
            className="h-full w-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="min-w-0">
        <h1
          className={cn(
            "truncate",
            isFfChrome
              ? "font-ff-display text-sm font-bold uppercase tracking-[0.07em] text-[var(--ff-fg-primary)]"
              : "text-lg font-bold tracking-tight text-foreground"
          )}
        >
          {title}
        </h1>
        {tagline ? (
          <p
            className={cn(
              "truncate",
              isFfChrome
                ? "font-ff-ui text-[9px] font-normal uppercase tracking-[0.1em] text-[var(--ff-fg-faint)]"
                : "text-xs text-muted-foreground"
            )}
          >
            {tagline}
          </p>
        ) : null}
      </div>
    </div>
  );
}
