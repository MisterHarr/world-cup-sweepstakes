"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";
import { BRANDING } from "@/lib/branding";
import { normalizeDepartment } from "@/lib/departments";
import { ensureUserDoc } from "@/lib/userBootstrap";
import { signInWithGoogle } from "@/lib/googleAuth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const raw =
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  if (!raw) return fallback;
  return raw.replace(/^FirebaseError:\s*/i, "").trim() || fallback;
}

function readErrorCode(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code.toLowerCase() : "";
}

function authErrorMessage(err: unknown, fallback: string): string {
  const code = readErrorCode(err);
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/email-already-in-use") return "That email is already in use.";
  if (code === "auth/invalid-credential") return "Invalid email or password.";
  if (code === "auth/user-not-found") return "No account found for that email.";
  if (code === "auth/wrong-password") return "Invalid email or password.";
  if (code === "auth/weak-password") return "Password must be at least 6 characters.";
  if (code === "auth/operation-not-allowed") return "Email sign-in is not enabled.";
  if (code === "auth/too-many-requests") return "Too many attempts. Try again shortly.";
  if (code === "auth/network-request-failed") return "Network error. Check your connection.";
  return friendlyErrorMessage(err, fallback);
}

function looksLikeEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

function deriveDisplayNameFromEmail(value: string): string {
  const local = value.split("@")[0] ?? "";
  const base = local.replace(/[._-]+/g, " ").trim();
  if (!base) return "Player";
  return base
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  const [authMethod, setAuthMethod] = useState<"google" | "email">("google");
  const [emailMode, setEmailMode] = useState<"signup" | "signin">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [continuing, setContinuing] = useState(false);

  const signedIn = useMemo(() => Boolean(uid), [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUid(u?.uid ?? null);
      setDisplayName(u?.displayName ?? "");
      setChecking(false);
      setAuthBusy(false);
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
      setError(authErrorMessage(e, "Sign-in failed."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleEmailAuth() {
    if (authBusy) return;

    const trimmedEmail = email.trim();
    if (!looksLikeEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError("");
    setAuthBusy(true);

    try {
      if (emailMode === "signup") {
        const cred = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        const nextName = fullName.trim() || deriveDisplayNameFromEmail(trimmedEmail);
        if (nextName && cred.user.displayName !== nextName) {
          await updateProfile(cred.user, { displayName: nextName });
          setDisplayName(nextName);
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      setPassword("");
    } catch (e: unknown) {
      console.error(e);
      setError(
        authErrorMessage(
          e,
          emailMode === "signup"
            ? "Account creation failed."
            : "Email sign-in failed."
        )
      );
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
            <>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setAuthMethod("google");
                  }}
                  className={[
                    "h-10 rounded-lg text-sm font-semibold transition-colors",
                    authMethod === "google"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:text-foreground",
                  ].join(" ")}
                >
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setAuthMethod("email");
                  }}
                  className={[
                    "h-10 rounded-lg text-sm font-semibold transition-colors",
                    authMethod === "email"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:text-foreground",
                  ].join(" ")}
                >
                  Email
                </button>
              </div>

              {authMethod === "google" ? (
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={checking || authBusy}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {checking
                    ? "Checking..."
                    : authBusy
                      ? "Please wait..."
                      : "Sign in with Google"}
                </Button>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleEmailAuth();
                  }}
                >
                  {emailMode === "signup" ? (
                    <Input
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Full name (optional)"
                      autoComplete="name"
                      className="h-11"
                    />
                  ) : null}
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email address"
                    autoComplete="email"
                    className="h-11"
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    autoComplete={
                      emailMode === "signup" ? "new-password" : "current-password"
                    }
                    className="h-11"
                  />
                  <Button
                    type="submit"
                    disabled={checking || authBusy}
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                  >
                    {authBusy
                      ? "Please wait..."
                      : emailMode === "signup"
                        ? "Create Account"
                        : "Sign in with Email"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setError("");
                      setEmailMode((prev) =>
                        prev === "signup" ? "signin" : "signup"
                      );
                    }}
                    className="w-full h-10 text-sm font-semibold"
                  >
                    {emailMode === "signup"
                      ? "I already have an account"
                      : "Create a new account"}
                  </Button>
                </form>
              )}
            </>
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
