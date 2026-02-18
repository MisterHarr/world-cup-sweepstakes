"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";
import { BRANDING } from "@/lib/branding";
import { normalizeDepartment } from "@/lib/departments";
import { ensureUserDoc } from "@/lib/userBootstrap";
import { signInWithGoogle } from "@/lib/googleAuth";
import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";

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

function hasConfirmedEntry(data: Record<string, unknown> | null): boolean {
  if (!data) return false;

  const entry = isRecord(data.entry) ? data.entry : {};
  if (Boolean(entry.confirmedAt)) return true;

  const portfolio = Array.isArray(data.portfolio)
    ? data.portfolio.filter((item): item is Record<string, unknown> =>
        isRecord(item)
      )
    : [];
  const featuredCount = portfolio.filter(
    (team) =>
      team.role === "featured" &&
      typeof team.teamId === "string" &&
      team.teamId.trim().length > 0
  ).length;
  const drawnCount = portfolio.filter((team) => team.role === "drawn").length;

  return featuredCount >= 1 && drawnCount >= 5;
}

export function AuthLandingPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [checking, setChecking] = useState(true);

  const [error, setError] = useState<string>("");
  const [authBusy, setAuthBusy] = useState(false);

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
    if (authBusy) return;

    setError("");
    setAuthBusy(true);

    try {
      const mode = await signInWithGoogle(auth);
      if (mode === "redirect") {
        return;
      }
    } catch (e: unknown) {
      console.error(e);
      setError(friendlyErrorMessage(e, "Sign-in failed."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");

    try {
      await signOut(auth);
    } catch (e: unknown) {
      console.error(e);
      setError(friendlyErrorMessage(e, "Sign-out failed."));
    }
  }

  async function handleContinue() {
    if (!uid) return;
    if (continuing) return;

    setContinuing(true);
    setError("");

    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      const rawData = snap.exists() ? snap.data() : null;
      const data = isRecord(rawData) ? rawData : null;
      const dept = normalizeDepartment(data?.department);
      const confirmed = hasConfirmedEntry(data);

      const nextPath = confirmed ? "/dashboard" : "/featured-team";

      if (!dept) {
        router.push(`/department?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      router.push(nextPath);
    } catch (e: unknown) {
      console.error(e);
      setError(friendlyErrorMessage(e, "Failed to load your profile."));
      setContinuing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl p-6 sm:p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white/5 border border-white/15 mb-5 overflow-hidden p-2">
            <img
              src={BRANDING.logoSrc}
              alt={BRANDING.logoAlt}
              className="h-full w-full object-contain"
            />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-black text-foreground tracking-tight"
            style={{
              fontFamily:
                "\"Avenir Next\", \"Avenir\", \"SF Pro Display\", \"Helvetica Neue\", sans-serif",
            }}
          >
            {BRANDING.shortName}
          </h1>
          {signedIn ? (
            <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-foreground">
              Welcome {displayName?.trim() || "Player"}!
            </h2>
          ) : null}
        </div>

        {error ? (
          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive text-center">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {!signedIn ? (
            <Button
              onClick={handleGoogleSignIn}
              disabled={checking || authBusy}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              {checking ? "Checking..." : authBusy ? "Please wait..." : "Sign in with Google"}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleContinue}
                disabled={continuing}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                {continuing ? "Loading..." : "Continue"}
              </Button>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full h-11 text-sm font-semibold"
              >
                Sign Out
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
