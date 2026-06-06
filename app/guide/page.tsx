"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { cn } from "@/lib/utils";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

// ── Data ────────────────────────────────────────────────────────────────────

const POINTS = [
  "Win = +3 pts",
  "Draw = +1 pt",
  "Goal = +1.5 pts",
  "Clean sheet = +1 pt",
  "Yellow card = −0.25 pts",
  "Red card = −1 pt",
  "Star Team = all points × 2",
];

const TERMS = [
  { term: "Star Team", meaning: "Your chosen team. Earns double points." },
  { term: "Drawn Teams", meaning: "5 teams assigned to you by the tier-balanced draw — see Your squad section." },
  { term: "Transfer", meaning: "Swap one drawn team for another (one-time, after group stage)." },
  { term: "Clean Sheet", meaning: "0 goals conceded in a match. +1 pt." },
  { term: "Cards", meaning: "Yellow −0.25 pt · Red −1 pt." },
];

const SQUAD = [
  {
    label: "1 Star Team (your pick)",
    detail: "Choose any of the 48 teams. Locked for the whole tournament. Earns double points.",
  },
  {
    label: "5 Drawn Teams (auto-assigned)",
    detail: "You'll get a fair mix: a couple of favourites, a couple of mid-strength teams, and a couple of underdogs. Everyone gets the same kind of spread — picking a strong Star doesn't mean you also luck into the best drawn teams.",
  },
  {
    label: "How the spread works",
    detail: "Teams are split into 4 strength groups (Tier 1 = favourites, Tier 4 = underdogs). Your final 6-team squad always covers all four — counting your Star plus the 5 drawn.",
  },
  {
    label: "No repeats from the same group",
    detail: "You won't get any two teams from the same World Cup group. Your 6 teams will come from 6 different groups.",
  },
  {
    label: "Why we do it this way",
    detail: "It keeps the game fair. Everyone gets a real chance to score points — you'll have something to cheer for in every stage of the tournament, whether your favourites are still in it or you're rooting for an underdog upset.",
  },
];

const TRANSFERS = [
  { label: "1 transfer per player", detail: "One swap for the entire tournament." },
  { label: "Window: after group stage", detail: "Opens after all group matches finish (after 28 June). Closes before the Round of 32." },
  { label: "Drawn teams only", detail: "Your Star Team is locked — only drawn teams can be swapped." },
  { label: "Costs points (tiered)", detail: "Teams are ranked Tier 1 (elite) to Tier 4 (underdog). Upgrading costs 3 pts base + 4 pts per tier step up. Example: Tier 4 → Tier 1 = 3 + (3 × 4) = 15 pts. Moving sideways or down always costs 2 pts (flat). Minimum cost: 2 pts." },
  { label: "No duplicates", detail: "You can't pick up a team already in your squad." },
  { label: "Any drawn team", detail: "You can drop eliminated or active teams — the choice is yours." },
];

const TABS = [
  { label: "My Teams", meaning: "Your squad, scores, and next fixture." },
  { label: "Leaderboard", meaning: "Everyone's rank and total score." },
  { label: "Live", meaning: "Scores, results, and fixtures." },
  { label: "Transfer", meaning: "Swap a drawn team (window must be open)." },
  { label: "Guide", meaning: "This page." },
];

const KNOCKOUT = [
  {
    label: "No draws",
    detail: "Every knockout match has a winner. No draw points.",
  },
  {
    label: "Penalty shootouts",
    detail: "Win on pens = win (+3 pts). Goal points (1.5 pts each) only count for goals in normal time and extra time — not the shootout.",
  },
  {
    label: "Clean sheets",
    detail: "0 goals conceded in normal time + extra time = clean sheet (+1 pt). Shootout goals don't count.",
  },
  {
    label: "Star Team",
    detail: "The 2× multiplier still applies — wins, goals, and clean sheets all double.",
  },
];

const FAQS = [
  { q: "I don't follow football — can I still play?", a: "Yes. Pick any Star Team. Everything scores automatically." },
  { q: "Why does my Star Team score more?", a: "You locked in a 2× multiplier when you picked it — every point it earns counts double." },
  { q: "Can I swap my Star Team?", a: "No. Star Team is locked for the whole tournament." },
  { q: "What happens if my team loses on penalties?", a: "They lose the match — 0 points for the result. But they still earn 1.5 pts per goal scored in normal time and extra time." },
  { q: "Do penalty shootout goals count?", a: "No — only goals scored in normal time (90 mins) and extra time earn points (1.5 pts each). Shootout goals are just for deciding the winner." },
  { q: "What happens if two players finish on the same score?", a: "Tiebreaker: whoever's finishing portfolio teams scored more goals across the tournament wins. This is based on your 6 teams at the end (1 Star Team + 5 drawn) — not including any team you may have swapped out. If goals are also level, the prize pot is shared equally." },
  { q: "Can I sign up after the tournament has started?", a: "Yes — you can join at any time. But you'll only score from matches that haven't kicked off yet when you complete your sign-up. Historical results don't count toward your score. So joining later means fewer matches to score from." },
  { q: "How much does a transfer cost? Give me an example.", a: "It depends on the tier gap. Teams are Tier 1 (elite, e.g. Brazil, Argentina) to Tier 4 (underdogs). Example: you hold Haiti (Tier 4) and upgrade to England (Tier 1) — cost is 3 + 3×4 = 15 pts. If England then win 3 knockout matches and score 6 goals with 2 clean sheets, they earn 3×3 + 6×1.5 + 2×1 = 20 pts — a net gain of +5 pts. Moving sideways (same tier) or downgrading costs a flat 2 pts regardless of tiers. You always see the exact cost before confirming." },
];

// ── Collapsible section ──────────────────────────────────────────────────────

function GuideSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-border bg-card/75 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 sm:px-6 text-left"
      >
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6 border-t border-border/50">
          {children}
        </div>
      )}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

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
              userEmail={null}
              showUserTile={Boolean(user) && !loading}
              trailing={<AppOverflowMenuButton />}
            />
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-3">
          {authError ? (
            <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              {authError}
            </div>
          ) : null}

          <GuideSection title="Scoring" defaultOpen>
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
              {POINTS.map((rule) => (
                <li key={rule} className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-muted-foreground/40 shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </GuideSection>

          <GuideSection title="Your squad — how the draw works" defaultOpen>
            <div className="mt-3 space-y-2">
              {SQUAD.map((r) => (
                <div key={r.label} className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-sm font-semibold text-foreground">{r.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
                </div>
              ))}
            </div>
          </GuideSection>

          <GuideSection title="Knockout rounds &amp; penalties">
            <div className="mt-3 space-y-2">
              {KNOCKOUT.map((r) => (
                <div key={r.label} className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-sm font-semibold text-foreground">{r.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
                </div>
              ))}
            </div>
          </GuideSection>

          <GuideSection title="Transfers">
            <div className="mt-3 space-y-2">
              {TRANSFERS.map((r) => (
                <div key={r.label} className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-sm font-semibold text-foreground">{r.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
                </div>
              ))}
            </div>
          </GuideSection>

          <GuideSection title="Key terms">
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TERMS.map((item) => (
                <div key={item.term} className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-sm font-semibold text-foreground">{item.term}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.meaning}</p>
                </div>
              ))}
            </div>
          </GuideSection>

          <GuideSection title="Tabs">
            <div className="mt-3 space-y-2">
              {TABS.map((item) => (
                <div key={item.label} className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 font-semibold text-foreground">{item.label}</span>
                  <span className="text-muted-foreground">{item.meaning}</span>
                </div>
              ))}
            </div>
          </GuideSection>

          <GuideSection title="FAQ">
            <div className="mt-3 space-y-2">
              {FAQS.map((item) => (
                <div key={item.q} className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-sm font-semibold text-foreground">{item.q}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </GuideSection>
        </main>
      </div>
    </AppShellV0>
  );
}
