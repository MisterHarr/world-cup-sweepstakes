"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Clock3, TrendingDown } from "lucide-react";

import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth, db, functions } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import type { User } from "@/types";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";

type TransferHistoryRow = {
  id: string;
  dropTeamId: string | null;
  pickupTeamId: string | null;
  dropTeamName: string | null;
  pickupTeamName: string | null;
  dropTier: number | null;
  pickupTier: number | null;
  scoringPenaltyPoints: number;
  remainingTransfersBefore: number | null;
  remainingTransfersAfter: number | null;
  createdAtMs: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const raw =
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  if (!raw) return fallback;
  return raw.replace(/^FirebaseError:\s*/i, "").trim() || fallback;
}

function formatTimestamp(ms: number | null): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "Unknown time";
  return new Date(ms).toLocaleString();
}

export default function TransferHistoryPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);

  const [userDoc, setUserDoc] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyRows, setHistoryRows] = useState<TransferHistoryRow[]>([]);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const signedIn = Boolean(uid);
  const userDocData = useMemo<Record<string, unknown>>(
    () => (isRecord(userDoc) ? userDoc : {}),
    [userDoc]
  );
  const remainingTransfers = Math.max(
    0,
    Number(userDocData.remainingTransfers ?? 0)
  );

  async function handleGoogleSignIn() {
    if (authBusy) return;
    setError("");
    setStatus("Opening Google sign-in...");
    setAuthBusy(true);
    try {
      await signInWithGoogle(auth);
      setStatus("");
    } catch (err: unknown) {
      setStatus("");
      setError(friendlyErrorMessage(err, "Sign-in failed."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (authBusy) return;
    setError("");
    setStatus("Signing out...");
    setAuthBusy(true);
    try {
      await signOut(auth);
      setStatus("");
    } catch (err: unknown) {
      setStatus("");
      setError(friendlyErrorMessage(err, "Sign-out failed."));
    } finally {
      setAuthBusy(false);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid ?? null);
      setDisplayName(user?.displayName ?? "");
      setCheckingAuth(false);
      setUserDoc(null);
      setHistoryRows([]);
      setError("");

      if (!user) return;

      setLoadingUser(true);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) setUserDoc(snap.data() as User);
      } catch (err: unknown) {
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
      setHistoryRows([]);
      setLoadingHistory(false);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoadingHistory(true);
      setError("");
      try {
        const fn = httpsCallable(functions, "getTransferHistory");
        const res = await fn({ limit: 50 });
        if (cancelled) return;
        const payload = isRecord(res.data) ? res.data : {};
        const rowsRaw = Array.isArray(payload.rows) ? payload.rows : [];

        const mapped: TransferHistoryRow[] = rowsRaw
          .map((row: unknown) => {
            const data = isRecord(row) ? row : {};
            const id = asString(data.id);
            if (!id) return null;
            return {
              id,
              dropTeamId: asString(data.dropTeamId),
              pickupTeamId: asString(data.pickupTeamId),
              dropTeamName: asString(data.dropTeamName),
              pickupTeamName: asString(data.pickupTeamName),
              dropTier: asNumber(data.dropTier),
              pickupTier: asNumber(data.pickupTier),
              scoringPenaltyPoints: asNumber(data.scoringPenaltyPoints) ?? 0,
              remainingTransfersBefore: asNumber(data.remainingTransfersBefore),
              remainingTransfersAfter: asNumber(data.remainingTransfersAfter),
              createdAtMs: asNumber(data.createdAtMs),
            };
          })
          .filter((row): row is TransferHistoryRow => row !== null);

        setHistoryRows(mapped);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(
          `[transfer-history] ${friendlyErrorMessage(
            err,
            "Failed to load transfer history."
          )}`
        );
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const totalPenalty = useMemo(
    () =>
      historyRows.reduce(
        (sum, row) => sum + (Number.isFinite(row.scoringPenaltyPoints) ? row.scoringPenaltyPoints : 0),
        0
      ),
    [historyRows]
  );

  const navItems = buildMainNavItems({
    signedIn,
    authBusy: checkingAuth || authBusy,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
  });

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppShellV0 navItems={navItems} activeId="transfer">
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
              userDisplayName={signedIn ? displayName || null : null}
              userEmail={auth?.currentUser?.email ?? null}
              showUserTile={signedIn}
              trailing={<AppOverflowMenuButton />}
            />
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-4">
          {status && (
            <div className="text-sm text-foreground/90">{status}</div>
          )}
          {error && (
            <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          )}

          {!signedIn && (
            <div className="rounded-xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
              Sign in to view your transfer history.
            </div>
          )}

          {signedIn && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total Transfers
                  </p>
                  <p className="text-3xl font-bold">{historyRows.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total Penalty
                  </p>
                  <p className="text-3xl font-bold text-orange-300">
                    -{totalPenalty.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Remaining Transfers
                  </p>
                  <p className="text-3xl font-bold">{remainingTransfers}</p>
                </div>
              </div>

              {loadingHistory && (
                <div className="space-y-2">
                  <div className="h-20 rounded-xl bg-card/60 animate-pulse" />
                  <div className="h-20 rounded-xl bg-card/60 animate-pulse" />
                  <div className="h-20 rounded-xl bg-card/60 animate-pulse" />
                </div>
              )}

              {!loadingHistory && historyRows.length === 0 && (
                <div className="rounded-xl border border-border bg-card/70 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No transfers yet. Use the Transfer tab to make your first move.
                  </p>
                </div>
              )}

              {!loadingHistory && historyRows.length > 0 && (
                <div className="space-y-3">
                  {historyRows.map((row) => {
                    const dropName = row.dropTeamName ?? row.dropTeamId ?? "Unknown";
                    const pickupName = row.pickupTeamName ?? row.pickupTeamId ?? "Unknown";
                    return (
                      <article
                        key={row.id}
                        className="rounded-xl border border-border bg-card/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <ArrowRightLeft className="w-4 h-4 text-primary" />
                            <span>{dropName}</span>
                            <span className="text-muted-foreground">to</span>
                            <span>{pickupName}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="w-3.5 h-3.5" />
                            <span>{formatTimestamp(row.createdAtMs)}</span>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="rounded-md bg-background/50 p-2">
                            <p className="text-muted-foreground">Penalty</p>
                            <p className="font-semibold text-orange-300 flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" />
                              -{row.scoringPenaltyPoints}
                            </p>
                          </div>
                          <div className="rounded-md bg-background/50 p-2">
                            <p className="text-muted-foreground">Tier Swap</p>
                            <p className="font-semibold">
                              {row.dropTier ?? "?"} → {row.pickupTier ?? "?"}
                            </p>
                          </div>
                          <div className="rounded-md bg-background/50 p-2">
                            <p className="text-muted-foreground">Before</p>
                            <p className="font-semibold">{row.remainingTransfersBefore ?? "?"}</p>
                          </div>
                          <div className="rounded-md bg-background/50 p-2">
                            <p className="text-muted-foreground">After</p>
                            <p className="font-semibold">{row.remainingTransfersAfter ?? "?"}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </AppShellV0>
  );
}
