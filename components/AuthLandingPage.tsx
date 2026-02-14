"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trophy } from "lucide-react";

import { auth, db } from "@/lib/firebase";
import { ensureUserDoc } from "@/lib/userBootstrap";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";

export function AuthLandingPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [checking, setChecking] = useState(true);

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [continuing, setContinuing] = useState(false);

  const signedIn = useMemo(() => Boolean(uid), [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUid(u?.uid ?? null);
      setDisplayName(u?.displayName ?? "");
      setChecking(false);
      setContinuing(false);

      if (!u) return;

      try {
        await ensureUserDoc({
          uid: u.uid,
          displayName: u.displayName ?? "",
          email: u.email ?? "",
          photoURL: u.photoURL,
        });
      } catch (err) {
        console.error("ensureUserDoc failed:", err);
      }
    });
    return () => unsub();
  }, []);

  async function handleGoogleSignIn() {
    setError("");
    setStatus("");

    try {
      setStatus("Opening Google sign-in...");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      setStatus("");
    } catch (e: any) {
      console.error(e);
      setStatus("");
      setError(e?.message ?? "Sign-in failed.");
    }
  }

  async function handleSignOut() {
    setError("");
    setStatus("");

    try {
      setStatus("Signing out...");
      await signOut(auth);
      setStatus("");
    } catch (e: any) {
      console.error(e);
      setStatus("");
      setError(e?.message ?? "Sign-out failed.");
    }
  }

  async function handleContinue() {
    if (!uid) return;
    if (continuing) return;

    setContinuing(true);
    setError("");
    setStatus("Checking your profile...");

    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? (snap.data() as any) : null;
      const dept = data?.department ?? null;

      const confirmed =
        Boolean(data?.entry?.confirmedAt) ||
        Boolean(
          (data?.portfolio?.find?.((p: any) => p?.role === "featured")?.teamId) &&
            ((data?.portfolio?.filter?.((p: any) => p?.role === "drawn")?.length ??
              0) >= 5)
        );

      const nextPath = confirmed ? "/dashboard" : "/featured-team";

      if (!dept) {
        router.push(`/department?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      router.push(nextPath);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to load your profile.");
      setStatus("");
      setContinuing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-6 relative">
            <Trophy className="w-10 h-10 text-primary" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">World Cup 2026</h1>
          <p className="text-muted-foreground">Office Sweepstakes</p>
        </div>

        {/* Main Card */}
        <div className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl shadow-black/20">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {signedIn ? "Welcome back!" : "Get Started"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {signedIn
                ? "Click continue to access your teams"
                : "Sign in with Google to join the sweepstakes"}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Status Message */}
          {status && (
            <div className="mb-4 p-3 rounded-xl border border-primary/20 bg-primary/10 text-sm text-primary">
              {status}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {!signedIn ? (
              <Button
                onClick={handleGoogleSignIn}
                disabled={checking}
                className="w-full h-12"
                size="lg"
              >
                {checking ? "Checking..." : "Sign in with Google"}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleContinue}
                  disabled={continuing}
                  className="w-full h-12"
                  size="lg"
                >
                  {continuing ? "Loading..." : "Continue →"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full"
                  size="sm"
                >
                  Sign Out
                </Button>
              </>
            )}
          </div>

          {/* Info Text */}
          {signedIn && displayName && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Signed in as{" "}
              <span className="font-medium text-foreground">{displayName}</span>
            </p>
          )}
        </div>

        {/* Footer Note */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Choose your featured team → Draw 5 random teams → Earn points
        </p>
      </div>
    </div>
  );
}
