"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShellV0 } from "@/components/app-shell-v0";
import LeaderboardPanel, {
  type LBUser,
  type SquadTeamVM,
  type SquadVM,
} from "@/components/leaderboard/LeaderboardPanel";
import { auth, db, functions } from "@/lib/firebase";
import { buildMainNavItems } from "@/lib/mainNav";
import type { User } from "@/types";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

type Department = "Primary" | "Secondary" | "Admin";

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const raw =
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  if (!raw) return fallback;
  return raw.replace(/^FirebaseError:\s*/i, "").trim() || fallback;
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

  const [leaderboardData, setLeaderboardData] = useState<LBUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const signedIn = useMemo(() => Boolean(uid), [uid]);
  const department: Department | null = (userDoc as any)?.department ?? null;

  async function handleGoogleSignIn() {
    setError("");
    setStatus("Signing in...");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      setStatus("");
    } catch (err: any) {
      console.error(err);
      setStatus("");
      setError(err?.message ?? "Sign-in failed.");
    }
  }

  async function handleSignOut() {
    setError("");
    setStatus("Signing out...");
    try {
      await signOut(auth);
      setStatus("");
    } catch (err: any) {
      console.error(err);
      setStatus("");
      setError(err?.message ?? "Sign-out failed.");
    }
  }

  async function fetchSquadDetails(
    userId: string,
    displayNameFallback: string
  ): Promise<SquadVM> {
    const fn = httpsCallable(functions, "getSquadDetails");
    const res = await fn({ userId });
    const payload = res.data as any;

    const featuredRaw = payload?.featured ?? null;
    const drawnRaw = Array.isArray(payload?.drawn) ? payload.drawn : [];

    const featured: SquadTeamVM | null = featuredRaw
      ? {
          id: String(featuredRaw.id ?? featuredRaw.teamId ?? ""),
          name: String(featuredRaw.name ?? "Featured"),
          group: String(featuredRaw.group ?? ""),
          tier: Number(featuredRaw.tier ?? 4),
          flagUrl: String(featuredRaw.flagUrl ?? ""),
          role: "featured",
          contribution: Number(featuredRaw.contribution ?? 0),
        }
      : null;

    const drawn: SquadTeamVM[] = drawnRaw
      .map((team: any) => ({
        id: String(team.id ?? team.teamId ?? ""),
        name: String(team.name ?? "Team"),
        group: String(team.group ?? ""),
        tier: Number(team.tier ?? 4),
        flagUrl: String(team.flagUrl ?? ""),
        role: "drawn" as const,
        contribution: Number(team.contribution ?? 0),
      }))
      .filter((team: SquadTeamVM) => Boolean(team.id));

    const payloadTotalScore = Number(payload?.totalScore);
    const derivedTotalScore =
      Number(featured?.contribution ?? 0) +
      drawn.reduce((sum, team) => sum + Number(team.contribution ?? 0), 0);

    return {
      userId: String(payload?.userId ?? userId),
      displayName: String(payload?.displayName ?? displayNameFallback),
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
      } catch (err: any) {
        console.error(err);
        setError(`[users] ${err?.message ?? "Failed to load your profile."}`);
      } finally {
        setLoadingUser(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    if (loadingUser) return;
    if (checkingAuth) return;
    if (error) return;
    if (!department) router.replace("/department?next=/leaderboard");
  }, [signedIn, loadingUser, checkingAuth, error, department, router]);

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

        const payload = snap.data() as any;
        const rows = Array.isArray(payload?.rows) ? payload.rows : [];

        const mapped: LBUser[] = rows
          .map((row: any, idx: number) => ({
            id: String(row.userId ?? row.id ?? ""),
            rank: Number(row.rank ?? idx + 1),
            name: String(row.displayName ?? row.name ?? "Anonymous"),
            totalScore: Number(row.totalScore ?? 0),
            department: typeof row.department === "string" ? row.department : null,
            dept: typeof row.dept === "string" ? row.dept : null,
            teams: [],
          }))
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

  const navItems = buildMainNavItems({
    signedIn,
    authBusy: checkingAuth,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
    onPortfolio: () => router.push("/dashboard?tab=portfolio"),
    onTransfer: () => router.push("/dashboard?tab=market"),
    onLeaderboard: () => router.push("/leaderboard"),
    onLive: () => router.push("/dashboard?tab=bracket"),
  });

  return (
    <AppShellV0 navItems={navItems} activeId="leaderboard">
      <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 text-foreground selection:bg-primary/20 pb-20 md:pb-0">
        <header className="sticky top-0 z-20 bg-card/60 backdrop-blur-md text-foreground border-b border-border shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between lg:pr-[34rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-md p-1 overflow-hidden border border-white/10">
                <img
                  src="https://www.gardenschool.edu.my/wp-content/uploads/2021/09/gis-logo.png"
                  alt="GIS Logo"
                  className="w-full h-full object-contain"
                  onError={(e: any) => (e.currentTarget.style.display = "none")}
                />
              </div>
              <h1 className="font-bold text-lg tracking-tight">
                GIS 2026{" "}
                <span className="text-muted-foreground/70 font-normal">
                  LEADERBOARD
                </span>
              </h1>
            </div>

            <div className="hidden md:block text-[12px] text-muted-foreground">
              {signedIn
                ? displayName
                  ? `Signed in as ${displayName}`
                  : "Signed in"
                : checkingAuth
                  ? "Checking session..."
                  : "Signed out"}
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 md:p-8">
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
                className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 px-4 py-2 text-sm font-semibold hover:bg-emerald-500/25 transition-colors"
              >
                Sign in with Google
              </button>
            </div>
          )}

          {signedIn && loadingUser ? (
            <div className="rounded-2xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
              Loading your profile...
            </div>
          ) : null}

          {signedIn && !loadingUser && (
            <LeaderboardPanel
              data={leaderboardData}
              isLoading={loadingLeaderboard}
              fetchSquad={fetchSquadDetails}
              currentUserId={uid}
            />
          )}
        </main>
      </div>
    </AppShellV0>
  );
}
