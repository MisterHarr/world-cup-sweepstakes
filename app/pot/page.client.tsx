"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, Coins, MessageCircle, QrCode } from "lucide-react";

import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { PRIZE_POT_CONFIG } from "@/lib/prizePot";
import {
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
} from "firebase/firestore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PotEntry {
  uid: string;
  displayName: string;
  paidAt: { seconds: number } | null;
  amount: number;
  currency: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: { seconds: number } | null): string {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(0)}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrizePotPageClient() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  // The current user's own pot entry (null = not paid in yet)
  const [myEntry, setMyEntry] = useState<PotEntry | null | undefined>(undefined);

  // All entries (for count + optional participant list)
  const [allEntries, setAllEntries] = useState<PotEntry[]>([]);

  // ── Auth ───────────────────────────────────────────────────────────────────

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

  // ── My entry ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setMyEntry(undefined);
      return;
    }
    const ref = doc(db, "potEntries", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setMyEntry(snap.data() as PotEntry);
        } else {
          setMyEntry(null);
        }
      },
      () => setMyEntry(null)
    );
    return () => unsub();
  }, [user]);

  // ── All entries (count + optional list) ──────────────────────────────────

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "potEntries"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAllEntries(
          snap.docs.map((d) => d.data() as PotEntry)
        );
      },
      () => setAllEntries([])
    );
    return () => unsub();
  }, [user]);

  // ── Auth actions ──────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await signInWithGoogle(auth);
    } catch {
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
    } catch {
      setAuthError("Sign-out failed. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  // ── Nav ───────────────────────────────────────────────────────────────────

  const navItems = buildMainNavItems({
    signedIn: Boolean(user),
    authBusy: loading || authBusy,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const entryCount = allEntries.length;
  const potTotal = entryCount * PRIZE_POT_CONFIG.amountPerEntry;
  const isPaid = myEntry != null;
  const myEntryLoaded = myEntry !== undefined;

  // ── Loading / redirect ────────────────────────────────────────────────────

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShellV0 navItems={navItems} activeId="pot">
      <div className="min-h-screen bg-[var(--ff-bg-app)] text-[var(--ff-fg-primary)] selection:bg-primary/20 pb-[calc(62px+env(safe-area-inset-bottom)+12px)]">

        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-[var(--ff-hairline)] bg-[var(--ff-bg-chrome)] text-[var(--ff-fg-primary)]">
          <div className="pt-safe">
            <FeaturedFiveTopBar
              className="mx-auto max-w-6xl px-4"
              brand={<AppBrandBlock variant="ff-chrome" title={BRANDING.shortName} />}
              liveCount={0}
              userDisplayName={user?.displayName ?? null}
              userEmail={null}
              showUserTile={Boolean(user) && !loading}
              trailing={<AppOverflowMenuButton />}
            />
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-4">

          {authError ? (
            <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              {authError}
            </div>
          ) : null}

          {/* ── Hero — pot summary ─────────────────────────────────────── */}
          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  {PRIZE_POT_CONFIG.potName}
                </h1>
                <p className="mt-1 text-sm text-[var(--ff-fg-secondary)]">
                  Optional entry · {formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)} per person
                </p>
              </div>
              <Coins className="size-8 shrink-0 text-[var(--ff-gold)] mt-0.5" aria-hidden />
            </div>

            {/* Pot total */}
            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-[var(--ff-gold)]">
                {formatAmount(potTotal, PRIZE_POT_CONFIG.currency)}
              </span>
              <span className="text-sm text-[var(--ff-fg-secondary)]">current pot</span>
            </div>
            <p className="mt-1 text-xs text-[var(--ff-fg-quieter-alt)]">
              {entryCount === 0
                ? "No entries yet — be the first in."
                : entryCount === 1
                ? "1 player has entered"
                : `${entryCount} players have entered`}
            </p>
          </section>

          {/* ── Your status ───────────────────────────────────────────── */}
          {myEntryLoaded ? (
            isPaid ? (
              <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-6 shrink-0 text-emerald-400" aria-hidden />
                  <div>
                    <p className="font-bold text-emerald-300">You&apos;re in the pot!</p>
                    <p className="text-xs text-[var(--ff-fg-secondary)] mt-0.5">
                      {formatAmount(myEntry!.amount, myEntry!.currency)} confirmed
                      {myEntry!.paidAt ? ` · ${formatDate(myEntry!.paidAt)}` : ""}
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-[var(--ff-gold)]/30 bg-[var(--ff-gold)]/5 p-5 sm:p-6">
                <p className="font-bold text-[var(--ff-fg-primary)]">Not yet entered</p>
                <p className="mt-1 text-sm text-[var(--ff-fg-secondary)]">
                  Scan the QR code below, pay {formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)}, then notify the admin. Your status will update automatically once confirmed.
                </p>
              </section>
            )
          ) : null}

          {/* ── QR payment ────────────────────────────────────────────── */}
          {!isPaid ? (
            <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                <QrCode className="size-5 shrink-0" aria-hidden />
                How to enter
              </h2>

              {/* QR image */}
              <div className="mt-4 flex justify-center">
                {PRIZE_POT_CONFIG.qrCodeImageUrl ? (
                  <div className="rounded-2xl border-2 border-[var(--ff-gold)]/40 bg-white p-3 shadow-lg">
                    <Image
                      src={PRIZE_POT_CONFIG.qrCodeImageUrl}
                      alt="Touch 'n Go / DuitNow QR code — scan to pay"
                      width={220}
                      height={220}
                      className="rounded-xl"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-[var(--ff-gold)]/30 bg-[var(--ff-bg-app)]">
                    <div className="text-center">
                      <QrCode className="size-12 mx-auto text-[var(--ff-fg-quieter-alt)]" aria-hidden />
                      <p className="mt-2 text-xs text-[var(--ff-fg-quieter-alt)]">QR code coming soon</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount badge */}
              <div className="mt-4 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ff-gold)] px-4 py-1.5 text-sm font-bold text-black">
                  {formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)}
                </span>
              </div>

              {/* Steps */}
              <ol className="mt-5 space-y-2.5 text-sm text-[var(--ff-fg-secondary)]">
                {[
                  "Open Touch ’n Go or your banking app",
                  "Scan the QR code above",
                  `Pay ${formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)} — use your display name as the payment reference`,
                  "Notify the admin so your entry can be confirmed",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ff-gold)]/15 text-[10px] font-bold text-[var(--ff-gold)]">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {/* WhatsApp CTA */}
              {PRIZE_POT_CONFIG.whatsappConfirmUrl ? (
                <div className="mt-5">
                  <a
                    href={PRIZE_POT_CONFIG.whatsappConfirmUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-3 text-sm font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20"
                  >
                    <MessageCircle className="size-4 shrink-0" aria-hidden />
                    Message admin on WhatsApp
                  </a>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* ── Participants ──────────────────────────────────────────── */}
          {entryCount > 0 ? (
            <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
              <h2 className="text-xl font-black tracking-tight">
                {PRIZE_POT_CONFIG.showParticipants ? "Who&apos;s in" : "Entries"}
              </h2>

              {PRIZE_POT_CONFIG.showParticipants ? (
                <ul className="mt-3 space-y-2">
                  {allEntries.map((entry) => (
                    <li
                      key={entry.uid}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium">{entry.displayName}</span>
                      <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Entered
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--ff-fg-secondary)]">
                  {entryCount === 1
                    ? "1 player has entered the pot."
                    : `${entryCount} players have entered the pot.`}
                </p>
              )}
            </section>
          ) : null}

        </main>
      </div>
    </AppShellV0>
  );
}
