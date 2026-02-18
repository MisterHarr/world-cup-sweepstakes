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
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import type { User } from "@/types";

import {
  onAuthStateChanged,
  signOut
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  const signedIn = useMemo(() => Boolean(uid), [uid]);
  const userDocData = useMemo<Record<string, unknown>>(
    () => (isRecord(userDoc) ? userDoc : {}),
    [userDoc]
  );
  const department: Department | null =
    userDocData.department === "Primary" ||
    userDocData.department === "Secondary" ||
    userDocData.department === "Admin"
      ? userDocData.department
      : null;

  async function handleGoogleSignIn() {
    if (authBusy) return;

    setError("");
    setStatus("Opening Google sign-in...");
    setAuthBusy(true);
    try {
      const mode = await signInWithGoogle(auth);
      if (mode === "redirect") {
        setStatus("Redirecting to Google sign-in...");
        return;
      }
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
          name: String(featuredRaw.name ?? "Featured"),
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

        const rawData = snap.data();
        const payload = isRecord(rawData) ? rawData : {};
        const rows = Array.isArray(payload.rows) ? payload.rows : [];

        const mapped: LBUser[] = rows
          .map((row: unknown, idx: number) => {
            const rowData = isRecord(row) ? row : {};
            return {
              id: String(rowData.userId ?? rowData.id ?? ""),
              rank: Number(rowData.rank ?? idx + 1),
              name: String(rowData.displayName ?? rowData.name ?? "Anonymous"),
              totalScore: Number(rowData.totalScore ?? 0),
              badgeCount: Number(rowData.badgeCount ?? 0),
              department:
                typeof rowData.department === "string"
                  ? rowData.department
                  : null,
              dept: typeof rowData.dept === "string" ? rowData.dept : null,
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

  const navItems = buildMainNavItems({
    signedIn,
    authBusy: checkingAuth || authBusy,
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
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.style.display = "none";
                  }}
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
