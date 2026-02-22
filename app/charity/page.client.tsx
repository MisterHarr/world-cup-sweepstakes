"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AppShellV0 } from "@/components/app-shell-v0";
import { Button } from "@/components/ui/button";
import { BRANDING } from "@/lib/branding";
import { CHARITY_CONFIG } from "@/lib/charity";
import { auth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

type PaymentRail = {
  id: string;
  label: string;
  href: string;
  note: string;
};

function buildRails(): PaymentRail[] {
  const rails: PaymentRail[] = [];
  if (CHARITY_CONFIG.stripePaymentLink) {
    rails.push({
      id: "stripe",
      label: "Contribute with Stripe",
      href: CHARITY_CONFIG.stripePaymentLink,
      note: "Card / wallet processing via Stripe Checkout",
    });
  }
  if (CHARITY_CONFIG.paypalDonateLink) {
    rails.push({
      id: "paypal",
      label: "Contribute with PayPal",
      href: CHARITY_CONFIG.paypalDonateLink,
      note: "PayPal hosted donation flow",
    });
  }
  return rails;
}

export default function CharityPageClient() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const rails = buildRails();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleGoogleSignIn() {
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await signInWithGoogle(auth);
    } catch (err) {
      console.error("Charity sign-in failed:", err);
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
      console.error("Charity sign-out failed:", err);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppShellV0 navItems={navItems} activeId="charity">
      <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 text-foreground selection:bg-primary/20 pb-8">
        <header className="sticky top-0 z-20 bg-card/60 backdrop-blur-md text-foreground border-b border-border shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="max-w-6xl mx-auto px-4 pr-16 sm:pr-4 h-16 flex items-center justify-between lg:pr-[34rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-md p-1 overflow-hidden border border-white/10">
                <img
                  src={BRANDING.logoSrc}
                  alt={BRANDING.logoAlt}
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="font-bold text-lg tracking-tight">Charity Pot</h1>
            </div>
            <div className="text-[11px] sm:text-[12px] text-muted-foreground max-w-[50vw] sm:max-w-[280px] truncate text-right leading-tight">
              {user ? (
                user.displayName ? (
                  <>
                    <span className="sm:hidden">{user.displayName}</span>
                    <span className="hidden sm:inline">{`Signed in as ${user.displayName}`}</span>
                  </>
                ) : (
                  "Signed in"
                )
              ) : (
                "Signed out"
              )}
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-4">
          {authError ? (
            <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
              {authError}
            </div>
          ) : null}

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {CHARITY_CONFIG.campaignName}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Beneficiary: {CHARITY_CONFIG.beneficiaryName}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {CHARITY_CONFIG.disclaimer}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6">
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">
              Contribute
            </h3>
            {rails.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rails.map((rail) => (
                  <div
                    key={rail.id}
                    className="rounded-xl border border-border bg-background/40 p-4"
                  >
                    <p className="text-sm text-muted-foreground mb-3">{rail.note}</p>
                    <Button asChild className="w-full min-h-[44px] font-bold">
                      <a href={rail.href} target="_blank" rel="noreferrer">
                        {rail.label}
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No payment links configured yet. Add `NEXT_PUBLIC_CHARITY_STRIPE_URL`
                and/or `NEXT_PUBLIC_CHARITY_PAYPAL_URL` to enable rails.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card/75 p-5 sm:p-6 text-sm text-muted-foreground space-y-2">
            <p>
              This module is feature-flagged and can be disabled instantly by setting{" "}
              <code className="mx-1">NEXT_PUBLIC_ENABLE_CHARITY_POT=false</code>.
            </p>
            {CHARITY_CONFIG.termsUrl ? (
              <p>
                Terms:{" "}
                <Link
                  href={CHARITY_CONFIG.termsUrl}
                  target="_blank"
                  className="text-primary underline underline-offset-2"
                >
                  View contribution terms
                </Link>
              </p>
            ) : null}
          </section>
        </main>
      </div>
    </AppShellV0>
  );
}
