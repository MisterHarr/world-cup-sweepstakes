"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Phone,
  QrCode,
} from "lucide-react";

import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { generatePotCode, PRIZE_POT_CONFIG } from "@/lib/prizePot";
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
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PotEntry {
  uid: string;
  displayName: string;
  code?: string;
  selfDeclaredAt?: { seconds: number } | null;
  selfDeclared?: boolean;
  status: "pending" | "confirmed";
  paidAt?: { seconds: number } | null;
  amount?: number;
  currency?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: { seconds: number } | null | undefined): string {
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

  // undefined = still loading, null = not declared, PotEntry = has entry
  const [myEntry, setMyEntry] = useState<PotEntry | null | undefined>(undefined);
  const [allConfirmed, setAllConfirmed] = useState<PotEntry[]>([]);
  const [allEntryCount, setAllEntryCount] = useState(0);

  const [declaring, setDeclaring] = useState(false);
  const [declareError, setDeclareError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  }, []);

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
    if (!user) { setMyEntry(undefined); return; }
    const ref = doc(db, "potEntries", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => setMyEntry(snap.exists() ? (snap.data() as PotEntry) : null),
      () => setMyEntry(null)
    );
    return () => unsub();
  }, [user]);

  // ── All confirmed entries (for public display) ────────────────────────────

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "potEntries"),
      where("status", "==", "confirmed")
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllConfirmed(snap.docs.map((d) => d.data() as PotEntry));
      setAllEntryCount(snap.size);
    }, () => {});
    return () => unsub();
  }, [user]);

  // ── Auth actions ──────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try { await signInWithGoogle(auth); }
    catch { setAuthError("Sign-in failed. Please try again."); }
    finally { setAuthBusy(false); }
  }

  async function handleSignOut() {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try { await signOut(auth); }
    catch { setAuthError("Sign-out failed. Please try again."); }
    finally { setAuthBusy(false); }
  }

  // ── Self-declaration ──────────────────────────────────────────────────────

  async function handleSelfDeclare() {
    if (!user || declaring) return;
    setDeclaring(true);
    setDeclareError("");
    try {
      const code = generatePotCode(user.uid);
      await setDoc(doc(db, "potEntries", user.uid), {
        uid: user.uid,
        displayName: user.displayName || user.uid,
        code,
        selfDeclaredAt: serverTimestamp(),
        status: "pending",
        selfDeclared: true,
      });
    } catch {
      setDeclareError("Couldn't record your payment — please try again.");
    } finally {
      setDeclaring(false);
    }
  }

  // ── Copy code ─────────────────────────────────────────────────────────────

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Nav ───────────────────────────────────────────────────────────────────

  const navItems = buildMainNavItems({
    signedIn: Boolean(user),
    authBusy: loading || authBusy,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const myCode = user ? generatePotCode(user.uid) : null;
  const potTotal = allEntryCount * PRIZE_POT_CONFIG.amountPerEntry;
  const isPending = myEntry?.status === "pending";
  const isConfirmed = myEntry?.status === "confirmed";
  const myEntryLoaded = myEntry !== undefined;

  // ── Spinner ───────────────────────────────────────────────────────────────

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

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                  {PRIZE_POT_CONFIG.potName}
                </h1>
                <p className="mt-1 text-sm text-[var(--ff-fg-secondary)]">
                  Optional · {formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)} per entry
                </p>
              </div>
              <Coins className="size-8 shrink-0 text-[var(--ff-gold)] mt-0.5" aria-hidden />
            </div>

            <div className="mt-5 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-[var(--ff-gold)]">
                {formatAmount(potTotal, PRIZE_POT_CONFIG.currency)}
              </span>
              <span className="text-sm text-[var(--ff-fg-secondary)]">current pot</span>
            </div>
            <p className="mt-1 text-xs text-[var(--ff-fg-quieter-alt)]">
              {allEntryCount === 0
                ? "No entries yet — be the first in."
                : allEntryCount === 1
                ? "1 confirmed player"
                : `${allEntryCount} confirmed players`}
            </p>
          </section>

          {/* ── Status card ──────────────────────────────────────────── */}
          {myEntryLoaded ? (
            isConfirmed ? (
              /* ✓ Confirmed */
              <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-6 shrink-0 text-emerald-400" aria-hidden />
                  <div>
                    <p className="font-bold text-emerald-300">You&apos;re in the pot!</p>
                    <p className="text-xs text-[var(--ff-fg-secondary)] mt-0.5">
                      {myEntry?.amount != null && myEntry?.currency
                        ? `${formatAmount(myEntry.amount, myEntry.currency)} confirmed`
                        : "Payment confirmed"}
                      {myEntry?.paidAt ? ` · ${formatDate(myEntry.paidAt)}` : ""}
                    </p>
                  </div>
                </div>
              </section>
            ) : isPending ? (
              /* ⏳ Pending */
              <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <Clock className="size-5 shrink-0 text-amber-400 mt-0.5" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-300">Pending confirmation</p>
                    <p className="text-xs text-[var(--ff-fg-secondary)] mt-0.5">
                      Your payment has been recorded. The admin will confirm it shortly.
                    </p>
                    {myEntry?.code ? (
                      <p className="mt-2 text-xs text-[var(--ff-fg-secondary)]">
                        Your code:{" "}
                        <span className="font-mono font-bold text-amber-300 tracking-widest">
                          {myEntry.code}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              /* Not entered yet — shown above the QR section */
              <section className="rounded-2xl border border-[var(--ff-gold)]/30 bg-[var(--ff-gold)]/5 p-5 sm:p-6">
                <p className="font-bold text-[var(--ff-fg-primary)]">Not yet entered</p>
                <p className="mt-1 text-sm text-[var(--ff-fg-secondary)]">
                  Follow the steps below to join the pot.
                </p>
              </section>
            )
          ) : null}

          {/* ── QR + payment (only when not yet confirmed) ────────────── */}
          {!isConfirmed ? (
            <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6 space-y-5">
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                <QrCode className="size-5 shrink-0" aria-hidden />
                {isPending ? "Your payment details" : "How to enter"}
              </h2>

              {/* Your unique code */}
              {myCode ? (
                <div className="rounded-xl border border-[var(--ff-gold)]/30 bg-[var(--ff-gold)]/8 p-4">
                  <p className="text-xs text-[var(--ff-fg-secondary)] mb-2">
                    Your unique payment code — include this as the reference when you pay
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-3xl font-black tracking-[0.2em] text-[var(--ff-gold)]">
                      {myCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(myCode)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--ff-gold)]/30 bg-[var(--ff-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--ff-gold)] transition-colors hover:bg-[var(--ff-gold)]/20"
                    >
                      <Copy className="size-3" aria-hidden />
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* QR or Send Money — switches based on device */}
              {isMobile && PRIZE_POT_CONFIG.tngPhone ? (
                /* Mobile: can't scan own screen — show Send Money instructions */
                <div className="rounded-xl border border-[var(--ff-gold)]/30 bg-[var(--ff-gold)]/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 shrink-0 text-[var(--ff-gold)]" aria-hidden />
                    <p className="text-sm font-semibold text-[var(--ff-fg-primary)]">
                      Pay via Touch &apos;n Go — Send Money
                    </p>
                  </div>
                  <p className="text-sm text-[var(--ff-fg-secondary)]">
                    Open TnG → <strong className="text-[var(--ff-fg-primary)]">Send Money</strong> → search or enter this number:
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-black tracking-wider text-[var(--ff-gold)]">
                      {PRIZE_POT_CONFIG.tngPhone}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(PRIZE_POT_CONFIG.tngPhone!)}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--ff-gold)]/30 bg-[var(--ff-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--ff-gold)] hover:bg-[var(--ff-gold)]/20"
                    >
                      <Copy className="size-3" aria-hidden />
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-[var(--ff-fg-quieter-alt)]">
                    Remember to enter your code <span className="font-mono font-bold text-[var(--ff-gold)]">{myCode}</span> as the payment note.
                  </p>
                </div>
              ) : (
                /* Desktop (or no phone number configured): show QR code */
                <div className="flex justify-center">
                  {PRIZE_POT_CONFIG.qrCodeImageUrl ? (
                    <div className="rounded-2xl border-2 border-[var(--ff-gold)]/40 bg-white p-3 shadow-lg">
                      <Image
                        src={PRIZE_POT_CONFIG.qrCodeImageUrl}
                        alt="Touch 'n Go / DuitNow QR code"
                        width={220}
                        height={220}
                        className="rounded-xl"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-[200px] w-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-[var(--ff-gold)]/30 bg-[var(--ff-bg-app)]">
                      <div className="text-center">
                        <QrCode className="size-10 mx-auto text-[var(--ff-fg-quieter-alt)]" aria-hidden />
                        <p className="mt-2 text-xs text-[var(--ff-fg-quieter-alt)]">QR code coming soon</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Amount */}
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ff-gold)] px-5 py-1.5 text-sm font-bold text-black">
                  {formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)}
                </span>
              </div>

              {/* Steps */}
              {!isPending ? (
                <ol className="space-y-2.5 text-sm text-[var(--ff-fg-secondary)]">
                  {(isMobile && PRIZE_POT_CONFIG.tngPhone
                    ? [
                        "Open Touch 'n Go",
                        `Tap Send Money and search for ${PRIZE_POT_CONFIG.tngPhone}`,
                        `Pay ${formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)} — enter your code (${myCode ?? "—"}) as the payment note`,
                        "Tap the button below once your payment is sent",
                      ]
                    : [
                        "Open Touch 'n Go or your banking app on your phone",
                        "Scan the QR code above",
                        `Pay ${formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)} — enter your code (${myCode ?? "—"}) as the payment reference`,
                        "Tap the button below once your payment is sent",
                      ]
                  ).map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ff-gold)]/15 text-[10px] font-bold text-[var(--ff-gold)]">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : null}

              {/* I've paid button */}
              {!isPending ? (
                <div className="pt-1">
                  {declareError ? (
                    <p className="mb-3 text-sm text-destructive">{declareError}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleSelfDeclare()}
                    disabled={declaring}
                    className="w-full rounded-xl bg-[var(--ff-gold)] px-4 py-3.5 text-base font-bold text-black transition-opacity disabled:opacity-50 hover:opacity-90"
                  >
                    {declaring ? "Recording…" : "I've paid — enter me"}
                  </button>
                  <p className="mt-2 text-center text-xs text-[var(--ff-fg-quieter-alt)]">
                    Only tap this after your payment is sent. An admin will confirm it shortly.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* ── Confirmed participants ────────────────────────────────── */}
          {allConfirmed.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
              <h2 className="text-xl font-black tracking-tight mb-3">
                {PRIZE_POT_CONFIG.showParticipants ? "Who&apos;s in" : "Entries"}
              </h2>

              {PRIZE_POT_CONFIG.showParticipants ? (
                <ul className="space-y-2">
                  {allConfirmed.map((entry) => (
                    <li
                      key={entry.uid}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium">{entry.displayName}</span>
                      <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        Confirmed
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--ff-fg-secondary)]">
                  {allEntryCount === 1
                    ? "1 player has entered the pot."
                    : `${allEntryCount} players have entered the pot.`}
                </p>
              )}
            </section>
          ) : null}

        </main>
      </div>
    </AppShellV0>
  );
}
