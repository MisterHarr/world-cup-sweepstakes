"use client";

import { ReactNode } from "react";
import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { auth } from "@/lib/firebase";
import { BRANDING } from "@/lib/branding";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: ReactNode;
  user?: { displayName: string | null; email?: string | null } | null;
  showAuth?: boolean;
}

export function AppShell({ children, user, showAuth = true }: AppShellProps) {
  async function handleSignOut() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header — Featured Five handoff chrome */}
      <header className="sticky top-0 z-40 border-b border-[var(--ff-hairline)] bg-[var(--ff-bg-chrome)] text-[var(--ff-fg-primary)]">
        <div className="pt-safe">
          <FeaturedFiveTopBar
            className="container mx-auto max-w-4xl px-4"
            brand={
              <AppBrandBlock
                variant="ff-chrome"
                title={BRANDING.shortName}
                tagline={BRANDING.tagline}
                logoTone="elevated"
              />
            }
            liveCount={0}
            userDisplayName={user?.displayName ?? null}
            userEmail={user?.email ?? null}
            showUserTile={Boolean(user)}
            trailing={
              showAuth && user ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="font-ff-ui h-8 border-[var(--ff-hairline-strong)] bg-transparent text-[11px] text-[var(--ff-fg-secondary)] hover:bg-white/[0.06]"
                  onClick={handleSignOut}
                >
                  Sign out
                </Button>
              ) : null
            }
          />
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
