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
  Lock,
  QrCode,
  Trophy,
} from "lucide-react";


import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { generatePotCode, PRIZE_POT_CONFIG, PRIZE_SPLIT } from "@/lib/prizePot";
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
import type { User as UserDoc } from "@/types";

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
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  // undefined = still loading, null = not declared, PotEntry = has entry
  const [myEntry, setMyEntry] = useState<PotEntry | null | undefined>(undefined);
  const [allEntryCount, setAllEntryCount] = useState(0);
  // null = still loading; true/false = computed from potLocked + entryDeadline
  const [potOpen, setPotOpen] = useState<boolean | null>(null);

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

  // ── Firestore user doc (for username in top bar) ──────────────────────────

  useEffect(() => {
    if (!user) { setUserDoc(null); return; }
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null);
    }, () => setUserDoc(null));
    return () => unsub();
  }, [user]);

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
      setAllEntryCount(snap.size);
    }, () => {});
    return () => unsub();
  }, [user]);

  // ── Pot open/close state ──────────────────────────────────────────────────

  useEffect(() => {
    const ref = doc(db, "settings", "prizePot");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setPotOpen(true); // no doc = treat as open (default)
          return;
        }
        const data = snap.data() as {
          potLocked?: boolean;
          open?: boolean; // legacy
          entryDeadline?: { seconds: number } | null;
        };
        // potLocked is the authoritative server lock; fall back to !open for
        // back-compat with docs written before this field existed.
        const isLocked = data.potLocked === true || data.open === false;
        const deadline = data.entryDeadline ?? null;
        const pastDeadline =
          deadline !== null && Date.now() / 1000 >= deadline.seconds;
        setPotOpen(!isLocked && !pastDeadline);
      },
      () => setPotOpen(true) // error fallback: show as open
    );
    return () => unsub();
  }, []);

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
      setDeclareError("Couldn't record your entry — please try again.");
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
    suppressBadges: true,
  });

  const topBarDisplayName =
    (userDoc?.username as string | undefined)?.trim() ||
    user?.displayName ||
    null;

  // ── Derived ───────────────────────────────────────────────────────────────

  const myCode = user ? generatePotCode(user.uid) : null;
  const potTotal = allEntryCount * PRIZE_POT_CONFIG.amountPerEntry;
  const isPending = myEntry?.status === "pending";
  const isConfirmed = myEntry?.status === "confirmed";
  const myEntryLoaded = myEntry !== undefined;
  // Show QR section only when: entry status loaded, not confirmed, and pot is open
  const showQrSection = myEntryLoaded && !isConfirmed && potOpen === true;

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
              userDisplayName={topBarDisplayName}
              userEmail={null}
              showUserTile={Boolean(user) && !loading}
              trailing={<AppOverflowMenuButton />}
            />
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-4 md:p-8">

          {authError ? (
            <div className="mb-4 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              {authError}
            </div>
          ) : null}

          {/* ── Two-column on md+ when QR is visible ─────────────────── */}
          <div className={showQrSection ? "md:grid md:grid-cols-2 md:gap-6 md:items-start space-y-4 md:space-y-0" : "space-y-4"}>

            {/* ── Left: Hero + pending status ──────────────────────────── */}
            <div className="space-y-4">

              {/* Hero */}
              <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                    {PRIZE_POT_CONFIG.potName}
                  </h1>
                  <div className="flex items-center gap-2 shrink-0">
                    {isConfirmed ? (
                      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                        <CheckCircle2 className="size-3.5" aria-hidden />
                        You&apos;re in
                      </span>
                    ) : null}
                    <Coins className="size-7 text-[var(--ff-gold)]" aria-hidden />
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
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
                  {isConfirmed && myEntry?.paidAt
                    ? ` · entry confirmed ${formatDate(myEntry.paidAt)}`
                    : null}
                </p>
              </section>

              {/* Prize split */}
              <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Trophy className="size-4 text-[var(--ff-gold)] shrink-0" aria-hidden />
                  <h2 className="text-sm font-semibold text-[var(--ff-fg-primary)]">Prize split</h2>
                </div>
                <div className="space-y-3">
                  {PRIZE_SPLIT.map(({ place, label, pct }) => {
                    const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
                    const barColour =
                      place === 1
                        ? "bg-[var(--ff-gold)]"
                        : place === 2
                        ? "bg-slate-400"
                        : "bg-orange-500";
                    const textColour =
                      place === 1
                        ? "text-[var(--ff-gold)]"
                        : place === 2
                        ? "text-slate-300"
                        : "text-orange-400";
                    const amount = potTotal > 0 ? Math.floor(potTotal * pct / 100) : null;
                    return (
                      <div key={place} className="flex items-center gap-3">
                        <span className="text-base leading-none w-5 shrink-0">{medal}</span>
                        <span className="text-xs font-semibold text-[var(--ff-fg-secondary)] w-6 shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColour}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--ff-fg-quieter-alt)] w-7 shrink-0 text-right">{pct}%</span>
                        <span className={`text-sm font-bold ${textColour} w-16 shrink-0 text-right`}>
                          {amount !== null
                            ? formatAmount(amount, PRIZE_POT_CONFIG.currency)
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-[var(--ff-fg-quieter-alt)]">
                  Amounts update live as players enter. Ties at the same position share that prize equally.
                </p>
              </section>

              {/* Pending status */}
              {myEntryLoaded && isPending ? (
                <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <Clock className="size-5 shrink-0 text-amber-400 mt-0.5" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-amber-300">Awaiting confirmation</p>
                      <p className="text-xs text-[var(--ff-fg-secondary)] mt-0.5">
                        Entry recorded — you&apos;ll be confirmed soon.
                      </p>
                      {myEntry?.code ? (
                        <p className="mt-2 text-xs text-[var(--ff-fg-secondary)]">
                          Your reference code:{" "}
                          <span className="font-mono font-bold text-amber-300 tracking-widest">
                            {myEntry.code}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

            </div>

            {/* ── Right: closed notice (entry status known, not confirmed, pot closed) ── */}
            {myEntryLoaded && !isConfirmed && potOpen === false ? (
              <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2 text-[var(--ff-fg-secondary)]">
                  <Lock className="size-4 shrink-0" aria-hidden />
                  <span className="font-semibold text-sm">Entries closed</span>
                </div>
                <p className="text-sm text-[var(--ff-fg-secondary)]">
                  The pot isn&apos;t accepting new entries at the moment.
                </p>
              </section>
            ) : null}

            {/* ── Right: QR + steps (hidden once confirmed, not shown until entry status loaded) ── */}
            {showQrSection ? (
              <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6 space-y-5">
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <QrCode className="size-4 shrink-0" aria-hidden />
                  {isPending ? "Your entry details" : "How to enter"}
                </h2>

                {/* Your unique code */}
                {myCode ? (
                  <div className="rounded-xl border border-[var(--ff-gold)]/30 bg-[var(--ff-gold)]/8 p-4">
                    <p className="text-xs text-[var(--ff-fg-secondary)] mb-2">
                      Use this as your entry reference
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

                {/* QR code */}
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

                {/* Mobile tip */}
                {isMobile ? (
                  <div className="rounded-xl border border-[var(--ff-gold)]/20 bg-[var(--ff-gold)]/5 px-4 py-3 text-xs text-[var(--ff-fg-secondary)]">
                    <strong className="text-[var(--ff-fg-primary)]">On your phone?</strong>{" "}
                    Long-press the QR → Save to Photos, then open Touch &apos;n Go →{" "}
                    <strong className="text-[var(--ff-fg-primary)]">Scan</strong> → tap{" "}
                    <strong className="text-[var(--ff-fg-primary)]">Gallery</strong>.
                  </div>
                ) : null}

                {/* Rules summary */}
                {!isPending ? (
                  <details className="rounded-xl border border-[var(--ff-hairline)] bg-[var(--ff-bg-card)]">
                    <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-[var(--ff-fg-secondary)] font-ff-ui">
                      How does it work?
                    </summary>
                    <div className="space-y-2.5 border-t border-[var(--ff-hairline)] px-4 py-3.5 text-xs text-[var(--ff-fg-quiet)] font-ff-ui leading-relaxed">
                      <p>Totally optional — just a bit of extra fun on top of the sweepstakes. Chuck in <strong className="text-[var(--ff-fg-primary)]">RM{PRIZE_POT_CONFIG.amountPerEntry}</strong> via Touch&nbsp;&apos;n&nbsp;Go and you&apos;re in the running for a slice of the pot.</p>
                      <p>Once you&apos;ve transferred, tap <strong className="text-[var(--ff-fg-primary)]">"I've paid"</strong> to let us know. Harrison will confirm your entry — until then you&apos;re not officially in, so make sure it goes through before the deadline.</p>
                      <p>Top 3 on the leaderboard (among paid players) split the pot: <strong className="text-[var(--ff-fg-primary)]">60&thinsp;%&thinsp;/&thinsp;30&thinsp;%&thinsp;/&thinsp;10&thinsp;%</strong>. If two people tie, they split that share equally.</p>
                      <p className="text-[var(--ff-fg-faint)]">Confirmation is manual — there&apos;s no automated payment check. If anything weird happens (cancelled game, data issues), Harrison calls it.</p>
                    </div>
                  </details>
                ) : null}

                {/* Steps + button */}
                {!isPending ? (
                  <>
                    <ol className="space-y-2.5 text-sm text-[var(--ff-fg-secondary)]">
                      {[
                        isMobile
                          ? "Save the QR to your photos, then open Touch 'n Go → Scan → Gallery"
                          : "Scan the QR with Touch 'n Go or your banking app",
                        `Transfer ${formatAmount(PRIZE_POT_CONFIG.amountPerEntry, PRIZE_POT_CONFIG.currency)} — use your code (${myCode ?? "—"}) as the reference`,
                        "Tap the button below once sent",
                      ].map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ff-gold)]/15 text-[10px] font-bold text-[var(--ff-gold)]">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
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
                        {declaring ? "Recording…" : "I've paid"}
                      </button>
                      <p className="mt-2 text-center text-xs text-[var(--ff-fg-quieter-alt)]">
                        Only tap this once your transfer is sent.
                      </p>
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}

          </div>

        </main>
      </div>
    </AppShellV0>
  );
}
