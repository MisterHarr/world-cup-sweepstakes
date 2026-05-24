"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

type FaqItem = { q: string; a: string };
type GlossaryItem = { term: string; meaning: string };
type NavHelpItem = { label: string; meaning: string };

const FIRST_TIME_STEPS = [
  "Sign in with Google.",
  "Pick your Star Team — this is the one team you choose yourself.",
  "The app randomly draws 5 more teams for you.",
  "Watch your score update automatically as matches are played.",
  "Check Leaderboard to see where you rank.",
];

const FOOTBALL_BASICS: GlossaryItem[] = [
  {
    term: "Star Team",
    meaning: "Your chosen team. Earns double points.",
  },
  {
    term: "Drawn Teams",
    meaning: "5 random teams the app assigns you.",
  },
  {
    term: "Transfer",
    meaning: "Swap one of your drawn teams for another.",
  },
  {
    term: "Clean Sheet",
    meaning: "A team that concedes 0 goals in a match. Worth +1 pt.",
  },
  {
    term: "Yellow / Red Card",
    meaning: "Cards reduce your team’s points.",
  },
];

const NAV_HELP: NavHelpItem[] = [
  {
    label: "My Teams",
    meaning: "Your squad, points breakdown, and next fixture for each team.",
  },
  {
    label: "Leaderboard",
    meaning: "Everyone’s scores and your current rank.",
  },
  {
    label: "Live",
    meaning: "Fixtures, results, and tournament bracket.",
  },
  {
    label: "Transfer",
    meaning: "Swap a drawn team (only available when the window is open).",
  },
];

const SIMPLE_POINTS_RULES = [
  "Win = +3 pts",
  "Draw = +1 pt",
  "Goal scored = +1 pt",
  "Clean sheet = +1 pt",
  "Yellow card = −0.5 pts",
  "Red card = −1 pt",
  "Star Team = all points × 2",
];

const FAQS: FaqItem[] = [
  {
    q: "I don’t follow football — can I still play?",
    a: "Yes. Pick any Star Team you like. The app scores everything automatically.",
  },
  {
    q: "Why does my Star Team score more?",
    a: "Its points are doubled, so it has the biggest impact on your total.",
  },
  {
    q: "Why can’t I transfer right now?",
    a: "The transfer window has to be open. When it’s closed, nobody can move teams.",
  },
  {
    q: "Can I swap my Star Team?",
    a: "No — only your 5 drawn teams can be swapped.",
  },
  {
    q: "Why did my score drop after a transfer?",
    a: "Each transfer costs points. The cost depends on how big the upgrade is.",
  },
];

export default function GuidePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user) return;
    setRedirecting(true);
    router.replace("/");
  }, [loading, user, router]);

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

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppShellV0 navItems={navItems} activeId="guide">
      <div className="min-h-screen bg-[var(--ff-bg-app)] text-[var(--ff-fg-primary)] selection:bg-primary/20 pb-[calc(62px+env(safe-area-inset-bottom)+12px)]">
        <header className="sticky top-0 z-20 border-b border-[var(--ff-hairline)] bg-[var(--ff-bg-chrome)] text-[var(--ff-fg-primary)]">
          <div className="pt-safe">
            <FeaturedFiveTopBar
              className="mx-auto max-w-6xl px-4"
              brand={
                <AppBrandBlock
                  variant="ff-chrome"
                  title={BRANDING.shortName}
                  tagline={BRANDING.tagline}
                />
              }
              liveCount={0}
              userDisplayName={user?.displayName ?? null}
              userEmail={auth?.currentUser?.email ?? null}
              showUserTile={Boolean(user)}
              trailing={<AppOverflowMenuButton />}
            />
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
          {authError ? (
            <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              {authError}
            </div>
          ) : null}

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-xl font-black tracking-tight">Getting started</h2>
            <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
              {FIRST_TIME_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-xl font-black tracking-tight">Key terms</h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FOOTBALL_BASICS.map((item) => (
                <article
                  key={item.term}
                  className="rounded-xl border border-border bg-background/40 p-3"
                >
                  <h3 className="text-sm font-semibold text-foreground">{item.term}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.meaning}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-xl font-black tracking-tight">Points</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
              {SIMPLE_POINTS_RULES.map((rule) => (
                <li key={rule} className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-muted-foreground/40 shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-xl font-black tracking-tight">Tabs</h2>
            <div className="mt-3 space-y-2">
              {NAV_HELP.map((item) => (
                <div key={item.label} className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 font-semibold text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">{item.meaning}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-xl font-black tracking-tight">FAQ</h2>
            <div className="mt-3 space-y-3">
              {FAQS.map((item) => (
                <article
                  key={item.q}
                  className="rounded-xl border border-border bg-background/40 p-3.5"
                >
                  <h3 className="text-sm font-semibold text-foreground">{item.q}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground">{item.a}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </AppShellV0>
  );
}
