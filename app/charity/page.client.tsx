"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AppBrandBlock } from "@/components/AppBrandBlock";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const rails = buildRails();

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

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppShellV0 navItems={navItems} activeId="charity">
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
              userDisplayName={user?.displayName ?? null}
              userEmail={auth.currentUser?.email ?? null}
              showUserTile={Boolean(user)}
              trailing={<AppOverflowMenuButton />}
            />
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
