"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
import LeaderboardPanel, {
  type LBUser,
  type SquadTeamVM,
  type SquadVM,
} from "@/components/leaderboard/LeaderboardPanel";
import { BRANDING } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { auth, db, functions } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { PRIZE_POT_CONFIG, PRIZE_SPLIT } from "@/lib/prizePot";
import type { User } from "@/types";

import {
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const raw =
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  if (!raw) return fallback;
  return raw.replace(/^FirebaseError:\s*/i, "").trim() || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function resolveLeaderboardUserId(row: Record<string, unknown>): string {
  return (
    toTrimmedString(row.userId) ??
    toTrimmedString(row.uid) ??
    toTrimmedString(row.id) ??
    ""
  );
}

export default function StandaloneLeaderboardPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [userDoc, setUserDoc] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [authBusy, setAuthBusy] = useState(false);

  const [leaderboardData, setLeaderboardData] = useState<LBUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [liveMatchCount, setLiveMatchCount] = useState(0);
  const [remainingTransfers, setRemainingTransfers] = useState(0);

  // Prize Pot tab
  const [activeTab, setActiveTab] = useState<"overall" | "pot">("overall");
  const [confirmedUids, setConfirmedUids] = useState<Set<string>>(new Set());

  const signedIn = useMemo(() => Boolean(uid), [uid]);
  async function handleGoogleSignIn() {
    if (authBusy) return;

    setError("");
    setStatus("Opening Google sign-in...");
    setAuthBusy(true);
    try {
      await signInWithGoogle(auth);
      setStatus("");
    } catch (err: unknown) {
      console.error(err);
      setStatus("");
      setError(friendlyErrorMessage(err, "Sign-in failed."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setStatus("Signing out...");
    try {
      await signOut(auth);
      setStatus("");
    } catch (err: unknown) {
      console.error(err);
      setStatus("");
      setError(friendlyErrorMessage(err, "Sign-out failed."));
    }
  }

  async function fetchSquadDetails(
    userId: string,
    displayNameFallback: string
  ): Promise<SquadVM> {
    const fn = httpsCallable(functions, "getSquadDetails");
    const res = await fn({ userId });
    const payload = isRecord(res.data) ? res.data : {};

    const featuredRaw = isRecord(payload.featured) ? payload.featured : null;
    const drawnRaw = Array.isArray(payload.drawn) ? payload.drawn : [];

    const featured: SquadTeamVM | null = featuredRaw
      ? {
          id: String(featuredRaw.id ?? featuredRaw.teamId ?? ""),
          name: String(featuredRaw.name ?? "Star Team"),
          group: String(featuredRaw.group ?? ""),
          tier: Number(featuredRaw.tier ?? 4),
          flagUrl: String(featuredRaw.flagUrl ?? ""),
          role: "featured",
          contribution: Number(featuredRaw.contribution ?? 0),
        }
      : null;

    const drawn: SquadTeamVM[] = drawnRaw
      .map((team: unknown) => {
        const teamData = isRecord(team) ? team : {};
        return {
          id: String(teamData.id ?? teamData.teamId ?? ""),
          name: String(teamData.name ?? "Team"),
          group: String(teamData.group ?? ""),
          tier: Number(teamData.tier ?? 4),
          flagUrl: String(teamData.flagUrl ?? ""),
          role: "drawn" as const,
          contribution: Number(teamData.contribution ?? 0),
        };
      })
      .filter((team: SquadTeamVM) => Boolean(team.id));

    const payloadTotalScore = Number(payload.totalScore);
    const derivedTotalScore =
      Number(featured?.contribution ?? 0) +
      drawn.reduce((sum, team) => sum + Number(team.contribution ?? 0), 0);

    return {
      userId: String(payload.userId ?? userId),
      displayName: String(payload.displayName ?? displayNameFallback),
      totalScore: Number.isFinite(payloadTotalScore)
        ? payloadTotalScore
        : derivedTotalScore,
      featured,
      drawn: drawn.slice(0, 5),
    };
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid ?? null);
      setDisplayName(user?.displayName ?? "");
      setCheckingAuth(false);

      setUserDoc(null);
      setError("");
      setStatus("");
      setLeaderboardData([]);

      if (!user) return;

      setLoadingUser(true);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) setUserDoc(snap.data() as User);
      } catch (err: unknown) {
        console.error(err);
        setError(
          `[users] ${friendlyErrorMessage(err, "Failed to load your profile.")}`
        );
      } finally {
        setLoadingUser(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setLeaderboardData([]);
      setLoadingLeaderboard(false);
      return;
    }

    setLoadingLeaderboard(true);
    const ref = doc(db, "leaderboard", "current");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setLeaderboardData([]);
          setLoadingLeaderboard(false);
          return;
        }

        const rawData = snap.data();
        const payload = isRecord(rawData) ? rawData : {};
        const rows = Array.isArray(payload.rows) ? payload.rows : [];

        const mapped: LBUser[] = rows
          .map((row: unknown, idx: number) => {
            const rowData = isRecord(row) ? row : {};
            const id = resolveLeaderboardUserId(rowData);
            return {
              id,
              rank: Number(rowData.rank ?? idx + 1),
              name: String(rowData.displayName ?? rowData.name ?? "Anonymous"),
              totalScore: Number(rowData.totalScore ?? 0),
              teams: [],
            };
          })
          .filter((row: LBUser) => Boolean(row.id));

        setLeaderboardData(mapped);
        setLoadingLeaderboard(false);
      },
      (err) => {
        const code = typeof err?.code === "string" ? err.code : "";
        if (code === "permission-denied") {
          setLeaderboardData([]);
          setLoadingLeaderboard(false);
          return;
        }
        console.error(err);
        setError(
          `[leaderboard] ${friendlyErrorMessage(
            err,
            "Failed to load leaderboard."
          )}`
        );
        setLoadingLeaderboard(false);
      }
    );

    return () => {
      unsub();
    };
  }, [signedIn]);

  // Live match count
  useEffect(() => {
    const q = query(collection(db, "matches"), where("status", "==", "LIVE"));
    const unsub = onSnapshot(q, (snap) => setLiveMatchCount(snap.size), () => {});
    return () => unsub();
  }, []);

  // Remaining transfers from user doc
  useEffect(() => {
    if (!uid) { setRemainingTransfers(0); return; }
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      const data = snap.data() ?? {};
      setRemainingTransfers(Math.max(0, Number(data.remainingTransfers ?? 0)));
    }, () => {});
    return () => unsub();
  }, [uid]);

  // Confirmed pot entrants (for Prize Pot standings tab)
  useEffect(() => {
    if (!signedIn || !PRIZE_POT_CONFIG.enabled) {
      setConfirmedUids(new Set());
      return;
    }
    const q = query(
      collection(db, "potEntries"),
      where("status", "==", "confirmed")
    );
    const unsub = onSnapshot(q, (snap) => {
      setConfirmedUids(new Set(snap.docs.map((d) => d.id)));
    }, () => setConfirmedUids(new Set()));
    return () => unsub();
  }, [signedIn]);

  // Prize Pot derived values
  const potLeaderboardData = useMemo<LBUser[]>(() => {
    if (!confirmedUids.size) return [];
    const filtered = leaderboardData.filter((row) => confirmedUids.has(row.id));
    // leaderboardData is already score-sorted from the server; preserve that order
    // and assign fresh ranks 1..N within the paid subset
    return filtered.map((row, idx) => ({ ...row, rank: idx + 1 }));
  }, [leaderboardData, confirmedUids]);

  const potTotal = confirmedUids.size * PRIZE_POT_CONFIG.amountPerEntry;
  const showPotTab = PRIZE_POT_CONFIG.enabled && signedIn && !loadingUser;
  const activeData = activeTab === "pot" ? potLeaderboardData : leaderboardData;

  const navItems = buildMainNavItems({
    signedIn,
    authBusy: checkingAuth || authBusy,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
    onPortfolio: () => router.push("/dashboard?tab=portfolio"),
    onTransfer: () => router.push("/dashboard?tab=market"),
    onLeaderboard: () => router.push("/leaderboard"),
    onLive: () => router.push("/dashboard?tab=bracket"),
  }).map((item) => {
    if (item.id === "live") return {
      ...item,
      badge: String(liveMatchCount),
      badgeVariant: liveMatchCount > 0 ? "live-active" as const : "live" as const,
    };
    if (item.id === "transfer") return {
      ...item,
      badge: remainingTransfers > 0 ? String(remainingTransfers) : "",
      badgeVariant: "amber" as const,
    };
    return item;
  });

  return (
    <AppShellV0 navItems={navItems} activeId="leaderboard">
      <div className="min-h-screen bg-[var(--ff-bg-app)] text-[var(--ff-fg-primary)] selection:bg-primary/20 pb-[calc(62px+env(safe-area-inset-bottom)+12px)]">
        <header className="sticky top-0 z-20 border-b border-[var(--ff-hairline)] bg-[var(--ff-bg-chrome)] text-[var(--ff-fg-primary)]">
          <div className="pt-safe">
            <FeaturedFiveTopBar
              className="mx-auto max-w-6xl px-4"
              brand={
                <AppBrandBlock
                  variant="ff-chrome"
                  title={BRANDING.shortName}
                />
              }
              liveCount={0}
              userDisplayName={(userDoc?.username as string | undefined) ?? displayName ?? null}
              userEmail={null}
              showUserTile={signedIn && !checkingAuth && !loadingUser}
              trailing={<AppOverflowMenuButton />}
            />
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-8">
          {error && (
            <div className="mb-4 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          )}
          {status && (
            <div className="mb-4 text-sm text-foreground/90">{status}</div>
          )}

          {!signedIn && !checkingAuth && (
            <div className="rounded-2xl border border-border bg-card/70 p-6 space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                Sign in to view the leaderboard
              </h2>
              <p className="text-sm text-muted-foreground">
                You need an account to view live standings and squad details.
              </p>
              <button
                onClick={handleGoogleSignIn}
                disabled={authBusy}
                className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 px-4 py-2 text-sm font-semibold hover:bg-emerald-500/25 transition-colors"
              >
                {authBusy ? "Please wait..." : "Sign in with Google"}
              </button>
            </div>
          )}

          {signedIn && loadingUser ? (
            <div className="rounded-2xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
              Loading your profile...
            </div>
          ) : null}

          {signedIn && !loadingUser && (
            <>
              {/* ── Tab control ── */}
              {showPotTab ? (
                <div className="mb-4 flex border-b border-[rgba(255,255,255,0.07)]">
                  <button
                    type="button"
                    onClick={() => setActiveTab("overall")}
                    className={cn(
                      "relative -mb-px flex min-h-[44px] items-center border-b-2 bg-transparent px-4 py-2 font-ff-ui text-[13px] transition-colors",
                      activeTab === "overall"
                        ? "z-[1] border-[var(--ff-accent-text)] font-semibold text-[#e8eaed]"
                        : "border-transparent font-normal text-[#5a6472] hover:text-[var(--ff-fg-secondary)]"
                    )}
                  >
                    Overall
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("pot")}
                    className={cn(
                      "relative -mb-px flex min-h-[44px] items-center gap-1.5 border-b-2 bg-transparent px-4 py-2 font-ff-ui text-[13px] transition-colors",
                      activeTab === "pot"
                        ? "z-[1] border-[var(--ff-accent-text)] font-semibold text-[#e8eaed]"
                        : "border-transparent font-normal text-[#5a6472] hover:text-[var(--ff-fg-secondary)]"
                    )}
                  >
                    The Pot
                  </button>
                </div>
              ) : null}

              {/* ── Prize Pot stats card (pot tab only) ── */}
              {activeTab === "pot" && showPotTab ? (
                <div className="mb-4 rounded-[14px] border border-[var(--ff-hairline)] bg-[var(--ff-bg-card)] p-4">
                  <div className="flex items-start justify-between gap-6 flex-wrap">

                    {/* Left — pot total */}
                    <div>
                      <p className="font-ff-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--ff-fg-quiet)]">
                        Prize pot
                      </p>
                      <p className="font-ff-display text-3xl font-black tracking-tight text-[var(--ff-gold)]">
                        {PRIZE_POT_CONFIG.currency}&nbsp;{potTotal}
                      </p>
                      <p className="mt-0.5 font-ff-ui text-[11px] text-[var(--ff-fg-faint)]">
                        {confirmedUids.size === 0
                          ? "No confirmed entries yet"
                          : confirmedUids.size === 1
                          ? "1 confirmed entry"
                          : `${confirmedUids.size} confirmed entries`}
                      </p>
                    </div>

                    {/* Right — split rows */}
                    <div className="space-y-2 min-w-[176px]">
                      {PRIZE_SPLIT.map(({ place, label, pct }) => {
                        const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
                        const amount = Math.floor(potTotal * pct / 100);
                        const amountColour =
                          place === 1
                            ? "text-[var(--ff-gold)]"
                            : place === 2
                            ? "text-[var(--ff-fg-tertiary)]"
                            : "text-orange-400";
                        return (
                          <div key={place} className="flex items-center gap-2">
                            <span className="w-5 text-sm leading-none">{medal}</span>
                            <span className="font-ff-ui text-[12px] font-semibold text-[var(--ff-fg-secondary)] w-7">
                              {label}
                            </span>
                            <span className="font-ff-ui text-[11px] text-[var(--ff-fg-faint)]">
                              {pct}%
                            </span>
                            <span className={cn("ml-auto font-ff-display text-[13px] font-bold tabular-nums", amountColour)}>
                              {potTotal > 0
                                ? `${PRIZE_POT_CONFIG.currency} ${amount}`
                                : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="mt-3 font-ff-ui text-[11px] text-[var(--ff-fg-faint)] border-t border-[var(--ff-hairline)] pt-3">
                    Only players with confirmed entries before the deadline are eligible.
                    Ties at the same position share that prize equally.
                  </p>
                </div>
              ) : null}

              <LeaderboardPanel
                data={activeData}
                isLoading={loadingLeaderboard}
                fetchSquad={fetchSquadDetails}
                currentUserId={uid}
                modeLabel={activeTab === "pot" ? "Prize Pot" : "Leaderboard"}
              />
            </>
          )}
        </main>
      </div>
    </AppShellV0>
  );
}
