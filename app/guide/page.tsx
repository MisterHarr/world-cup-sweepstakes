"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
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

type GlossaryItem = {
  term: string;
  meaning: string;
};

type NavHelpItem = {
  label: string;
  meaning: string;
};

const FIRST_TIME_STEPS = [
  "Sign in.",
  "Choose your group (Primary, Secondary, or Ops/Admin).",
  "Pick one Star Team (this is your main team).",
  "Confirm your pick and reveal your 5 random teams.",
  "Open My Teams to see your full squad and score.",
  "Use Leaderboard to see your rank compared with everyone else.",
];

const FOOTBALL_BASICS: GlossaryItem[] = [
  {
    term: "Star Team",
    meaning: "The team you choose yourself. Its points are doubled.",
  },
  {
    term: "Drawn Teams",
    meaning: "The 5 extra teams the app gives you at random.",
  },
  {
    term: "Transfer",
    meaning: "Swap one drawn team for another team.",
  },
  {
    term: "Clean Sheet",
    meaning: "A team that lets in 0 goals in a match.",
  },
  {
    term: "Yellow / Red Card",
    meaning: "Penalty cards in football. They reduce points.",
  },
];

const NAV_HELP: NavHelpItem[] = [
  {
    label: "My Teams",
    meaning: "Your full squad, total points, and team-by-team details.",
  },
  {
    label: "Leaderboard",
    meaning: "Who is currently winning and where you are ranked.",
  },
  {
    label: "Live",
    meaning: "Match updates and tournament progress.",
  },
  {
    label: "Transfer",
    meaning: "Where you swap teams (only when transfer window is open).",
  },
];

const SIMPLE_POINTS_RULES = [
  "Win = +3 points",
  "Draw = +1 point",
  "Each goal scored = +1 point",
  "Clean sheet (0 goals conceded) = +1 point",
  "Yellow card = -0.5 point",
  "Red card = -1 point",
  "Star Team points are always doubled",
];

const FAIRNESS_NOTES = [
  "Your 5 random teams are drawn by the server (not your browser).",
  "Your Star Team is removed from the random pool before the draw.",
  "Duplicate teams are blocked, so you cannot get the same team twice.",
  "Transfers are logged and penalty points are applied automatically.",
];

const FAQS: FaqItem[] = [
  {
    q: "I don’t know football. Can I still play?",
    a: "Yes. You only need to pick one Star Team. The app handles the rest and keeps scoring automatically.",
  },
  {
    q: "Why is my Star Team special?",
    a: "Your Star Team gets double points, so it has the biggest effect on your score.",
  },
  {
    q: "Why can’t I transfer right now?",
    a: "Transfers are only available when the transfer window is open. If the window is closed, everyone is locked.",
  },
  {
    q: "Can I transfer my Star Team?",
    a: "No. Only your 5 drawn teams can be swapped.",
  },
  {
    q: "Why did my score go down after a transfer?",
    a: "Every transfer has a point cost. Bigger upgrades usually cost more points.",
  },
  {
    q: "I don’t see the Charity tab. Is it broken?",
    a: "No. Charity is optional and can be turned on or off by the organisers.",
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
              className="mx-auto max-w-6xl px-4 pr-14 sm:pr-4"
              brand={
                <AppBrandBlock
                  variant="ff-chrome"
                  title={BRANDING.shortName}
                  tagline={BRANDING.tagline}
                />
              }
              liveCount={0}
              userDisplayName={user?.displayName ?? null}
              userEmail={auth.currentUser?.email ?? null}
              showUserTile={Boolean(user)}
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
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              You Don&apos;t Need Football Knowledge
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">
              This game is built so anyone can play, even if you have never watched
              football before.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FOOTBALL_BASICS.map((item) => (
                <article
                  key={item.term}
                  className="rounded-xl border border-border bg-background/40 p-4"
                >
                  <h3 className="font-semibold text-foreground">{item.term}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.meaning}</p>
                </article>
              ))}
            </div>
          </section>

          <section
            id="first-time"
            className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6 scroll-mt-24"
          >
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              First Time: What To Click
            </h2>
            <ol className="mt-4 space-y-2 text-sm sm:text-base text-muted-foreground list-decimal list-inside">
              {FIRST_TIME_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Main Tabs Explained
            </h2>
            <div className="mt-4 space-y-3">
              {NAV_HELP.map((item) => (
                <article
                  key={item.label}
                  className="rounded-xl border border-border bg-background/40 p-4"
                >
                  <h3 className="font-semibold text-foreground">{item.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.meaning}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              How Points Work (Simple)
            </h2>
            <ul className="mt-4 space-y-2 text-sm sm:text-base text-muted-foreground list-disc list-inside">
              {SIMPLE_POINTS_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              In plain terms: your score is your 6 teams&apos; points, with your Star Team
              counting double, minus any transfer costs.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Fairness & Trust
            </h2>
            <ul className="mt-4 space-y-2 text-sm sm:text-base text-muted-foreground list-disc list-inside">
              {FAIRNESS_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              If you want deeper rules detail, ask your organiser for the admin
              rules guide.
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
