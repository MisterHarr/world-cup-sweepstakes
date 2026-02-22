"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

type FaqItem = {
  q: string;
  a: string;
};

const HOW_TO_PLAY = [
  "Sign in using Google or email/password on the landing page.",
  "Pick your department (`Primary`, `Secondary`, or `Ops/Admin`).",
  "Choose 1 Featured Team.",
  "Confirm your entry and reveal your 5 randomly drawn teams.",
  "Open `My Teams` to track points and `Leaderboard` to track rank.",
  "Use `Transfer` during an open transfer window to swap drawn teams.",
];

const FAQS: FaqItem[] = [
  {
    q: "Why can’t I transfer right now?",
    a: "Transfers are blocked unless the admin opens the transfer window in /admin/fixtures.",
  },
  {
    q: "Can I transfer my Featured Team?",
    a: "No. Featured Team is locked after confirmation and always earns 2x points.",
  },
  {
    q: "How are random teams selected?",
    a: "The backend excludes your Featured Team, shuffles eligible teams, enforces uniqueness, and draws a tier-balanced set of 5.",
  },
  {
    q: "Why did my score drop after a transfer?",
    a: "Each transfer applies a penalty cost. Upgrade moves cost more than lateral/downgrade moves.",
  },
  {
    q: "Why does leaderboard order change after recompute?",
    a: "Rank is recalculated from latest match/team stats and transfer penalties whenever recompute runs.",
  },
  {
    q: "How does badges ranking work?",
    a: "The `Badges` tab sorts participants by badge count first, then by points as tie-breaker.",
  },
];

const TECH_NOTES = [
  "Team scoring formula: `wins*3 + draws*1 + goalsScored*1 + cleanSheets*1 - redCards*1 - yellowCards*0.5`.",
  "User total score formula: `featuredTeamPoints*2 + sum(drawnTeamPoints) - transferPenaltyPoints`.",
  "Transfer penalty model: `max(5, 10 + upgradeSteps*15 - downgradeSteps*3)`.",
  "Duplicate teams are blocked in all assignment and transfer paths.",
  "Department filters normalize values (`Primary`, `Secondary`, `Admin`) before ranking.",
];

export default function GuidePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleGoogleSignIn() {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await signInWithGoogle(auth);
    } catch (err) {
      console.error("Guide sign-in failed:", err);
      setAuthError("Sign-in failed. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Guide sign-out failed:", err);
      setAuthError("Sign-out failed. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  const navItems = buildMainNavItems({
    signedIn: Boolean(user),
    authBusy: loading || authBusy,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppShellV0 navItems={navItems} activeId="guide">
      <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 text-foreground selection:bg-primary/20 pb-8">
        <header className="sticky top-0 z-20 bg-card/60 backdrop-blur-md text-foreground border-b border-border shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="max-w-6xl mx-auto px-4 pr-16 sm:pr-4 h-16 flex items-center justify-between lg:pr-[34rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-md p-1 overflow-hidden border border-white/10">
                <img
                  src={BRANDING.logoSrc}
                  alt={BRANDING.logoAlt}
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="font-bold text-lg tracking-tight">User Guide</h1>
            </div>
            <div className="text-[11px] sm:text-[12px] text-muted-foreground max-w-[50vw] sm:max-w-[280px] truncate text-right leading-tight">
              {user ? (
                user.displayName ? (
                  <>
                    <span className="sm:hidden">{user.displayName}</span>
                    <span className="hidden sm:inline">{`Signed in as ${user.displayName}`}</span>
                  </>
                ) : (
                  "Signed in"
                )
              ) : (
                "Signed out"
              )}
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
          {authError ? (
            <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              {authError}
            </div>
          ) : null}

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Start Here
            </h2>
            <ol className="mt-4 space-y-2 text-sm sm:text-base text-muted-foreground list-decimal list-inside">
              {HOW_TO_PLAY.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Scoring Transparency
            </h2>
            <ul className="mt-4 space-y-2 text-sm sm:text-base text-muted-foreground list-disc list-inside">
              {TECH_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              For deeper operational details, see{" "}
              <Link
                href="/admin/runbook"
                className="text-primary underline underline-offset-2"
              >
                Admin Runbook
              </Link>
              .
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              FAQ
            </h2>
            <div className="mt-4 space-y-3">
              {FAQS.map((item) => (
                <article
                  key={item.q}
                  className="rounded-xl border border-border bg-background/40 p-4"
                >
                  <h3 className="font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </AppShellV0>
  );
}
