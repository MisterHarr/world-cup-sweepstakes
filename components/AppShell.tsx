"use client";

import { ReactNode } from "react";
import { auth } from "@/lib/firebase";
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
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white shadow-md p-1 overflow-hidden">
                <img
                  src="https://www.gardenschool.edu.my/wp-content/uploads/2021/09/gis-logo.png"
                  alt="GIS Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">GIS 2026 World Cup</h1>
                <p className="text-xs text-muted-foreground">Office Sweepstakes</p>
              </div>
            </div>

            {/* Auth Actions */}
            {showAuth && user && (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  {user.displayName || user.email}
                </span>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
