"use client";

import { createContext, useCallback, useContext, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Overflow menu context — lets children place the trigger anywhere ──────────
const OverflowMenuCtx = createContext<{ toggle: () => void; isOpen: boolean } | null>(null);

/** Renders the ≡ / ✕ toggle button. Place inside FeaturedFiveTopBar's trailing slot. */
export function AppOverflowMenuButton({ className }: { className?: string }) {
  const ctx = useContext(OverflowMenuCtx);
  if (!ctx) return null;
  const { toggle, isOpen } = ctx;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
      className={cn(
        "flex size-[26px] shrink-0 items-center justify-center rounded-[6px] border border-[var(--ff-hairline-strong)] bg-transparent text-[var(--ff-fg-secondary)] transition-colors hover:bg-white/[0.06]",
        className
      )}
    >
      {isOpen ? <X className="size-3.5" /> : <Menu className="size-3.5" />}
    </button>
  );
}

export type AppShellNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /** Optional count / label in a corner pip (Live / Transfer). */
  badge?: string;
  badgeVariant?: "live" | "live-active" | "amber";
};

const MAIN_BOTTOM_IDS = [
  "portfolio",
  "leaderboard",
  "live",
  "transfer",
] as const;

function isMainBottomId(id: string): id is (typeof MAIN_BOTTOM_IDS)[number] {
  return (MAIN_BOTTOM_IDS as readonly string[]).includes(id);
}

type AppShellV0Props = {
  children: React.ReactNode;
  navItems: AppShellNavItem[];
  activeId?: string;
};

export function AppShellV0({ children, navItems, activeId }: AppShellV0Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bounceId, setBounceId] = useState<string | null>(null);

  const bottomNavItems = MAIN_BOTTOM_IDS.map((id) =>
    navItems.find((n) => n.id === id)
  ).filter((n): n is AppShellNavItem => Boolean(n));

  const overflowNavItems = navItems.filter((n) => !isMainBottomId(n.id));

  const triggerBounce = useCallback((id: string) => {
    setBounceId(id);
    /* Keep in sync with `--ff-nav-bounce-ms` in globals.css (Featured Five handoff). */
    window.setTimeout(() => setBounceId(null), 350);
  }, []);

  return (
    <OverflowMenuCtx.Provider value={{ toggle: () => setMobileMenuOpen((v) => !v), isOpen: mobileMenuOpen }}>
    <div className="min-h-screen bg-background text-foreground">
      {/* Overflow menu panel — triggered by AppOverflowMenuButton in the top bar */}
      {mobileMenuOpen && overflowNavItems.length > 0 ? (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-[calc(4rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-right))] bg-card border border-border rounded-xl p-2 shadow-xl">
            {overflowNavItems.map((item) => {
              const active = activeId === item.id;
              const commonClass = cn(
                "w-full justify-start gap-2 mb-1",
                item.disabled && "opacity-50 cursor-not-allowed"
              );

              if (item.href && !item.disabled) {
                return (
                  <Button
                    key={item.id}
                    variant={active ? "default" : "ghost"}
                    size="default"
                    className={commonClass}
                    asChild
                  >
                    <Link
                      href={item.href}
                      onClick={() => {
                        item.onClick?.();
                        setMobileMenuOpen(false);
                      }}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  </Button>
                );
              }

              return (
                <Button
                  key={item.id}
                  variant={active ? "default" : "ghost"}
                  size="default"
                  className={commonClass}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onClick?.();
                    setMobileMenuOpen(false);
                  }}
                  disabled={item.disabled}
                  title={item.title}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Bottom tab bar — Featured Five handoff (all viewports) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex min-h-[62px] items-stretch border-t border-[var(--ff-hairline)] bg-[var(--ff-bg-blur)] pb-safe font-ff-ui backdrop-blur-[20px]"
        aria-label="Primary"
      >
        {bottomNavItems.map((item) => {
          const active = activeId === item.id;
          const Icon = item.icon;
          const bounce = bounceId === item.id;
          const pipTone =
            item.badgeVariant === "amber"
              ? "bg-[var(--ff-gold)] text-black"
              : item.badgeVariant === "live-active"
              ? "bg-emerald-500 text-black shadow-[0_0_6px_2px_rgba(52,211,153,0.7)]"
              : "bg-[var(--ff-danger)] text-black";

          const scaleClass = cn(
            bounce && "scale-[0.85]",
            !bounce && active && "scale-[1.05]",
            !bounce && !active && "scale-100",
            "motion-reduce:scale-100"
          );

          const inner = (
            <>
              <span className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                <Icon
                  className={cn(
                    "size-[19px] shrink-0",
                    active ? "text-[var(--ff-accent-text)]" : "text-[var(--ff-fg-quieter-alt)]"
                  )}
                  aria-hidden
                />
                {item.badgeVariant ? (
                  <span
                    className={cn(
                      "pointer-events-none absolute right-0 top-0 flex h-3.5 min-w-3.5 translate-x-1/2 -translate-y-0.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold leading-none",
                      pipTone
                    )}
                    aria-hidden
                  >
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[9px] font-medium uppercase tracking-[0.05em]",
                  active ? "font-semibold text-[var(--ff-accent-text)]" : "text-[var(--ff-fg-quieter-alt)]"
                )}
              >
                {item.label}
              </span>
            </>
          );

          const barClass = cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 border-t-2 border-transparent transition-transform duration-[var(--ff-nav-bounce-ms,350ms)] motion-reduce:transition-none [transition-timing-function:var(--ff-ease-bounce)]",
            scaleClass,
            active ? "border-[var(--ff-accent-text)]" : "",
            item.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer touch-manipulation select-none"
          );

          if (item.href && !item.disabled) {
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={false}
                className={cn(barClass, "no-underline outline-offset-[-2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ff-accent-text)]")}
                aria-current={active ? "page" : undefined}
                title={item.title}
                onClick={() => {
                  triggerBounce(item.id);
                  item.onClick?.();
                }}
              >
                {inner}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                barClass,
                "border-l-0 border-r-0 border-b-0 bg-transparent text-left outline-offset-[-2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ff-accent-text)]"
              )}
              aria-current={active ? "page" : undefined}
              title={item.title}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                triggerBounce(item.id);
                item.onClick?.();
              }}
            >
              {inner}
            </button>
          );
        })}
      </nav>

      {children}
    </div>
    </OverflowMenuCtx.Provider>
  );
}
