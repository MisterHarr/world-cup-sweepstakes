"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { auth, db } from "@/lib/firebase";
import { BRANDING } from "@/lib/branding";
import { ensureUserDoc } from "@/lib/userBootstrap";
import { signInWithGoogle } from "@/lib/googleAuth";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  if (code === "auth/popup-closed-by-user") return "";
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

function localEmailAuthErrorMessage(err: unknown, fallback: string): string {
  const code = readErrorCode(err);
  if (
    code === "auth/invalid-credential" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password"
  ) {
    return "That email/password was not found in the local Auth Emulator. Real Firebase/Google accounts are separate; use a local test account or create one here.";
  }
  return authErrorMessage(err, fallback);
}

function isExpectedAuthError(err: unknown): boolean {
  const code = readErrorCode(err);
  return code.startsWith("auth/");
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

function isLocalAuthEmulatorEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true") return false;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
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
  const [localAuthEmulator, setLocalAuthEmulator] = useState(false);
  const [authMethod, setAuthMethod] = useState<"google" | "email">("email");
  // Registration closes the moment the tournament kicks off.
  // Mexico vs South Africa, Estadio Azteca, 11 Jun 2026, 19:00 UTC (3 pm ET).
  const registrationClosed = Date.now() >= Date.parse("2026-06-11T19:00:00.000Z");
  const [emailMode, setEmailMode] = useState<"signup" | "signin">(
    registrationClosed ? "signin" : "signup"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const [continuing, setContinuing] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<string>("");
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);

  // Email signup races the auth-state listener: createUserWithEmailAndPassword
  // signs the user in (firing onAuthStateChanged → ensureUserDoc) before our
  // follow-up updateProfile() call has set the chosen display name on the Auth
  // user. ensureUserDoc would then see an empty displayName and permanently
  // bake "Anonymous" into the Firestore profile. Stash the chosen name here so
  // the listener can use it as an override regardless of which call wins the race.
  const pendingDisplayNameRef = useRef<string | null>(null);

  const signedIn = useMemo(() => Boolean(uid), [uid]);

  useEffect(() => {
    const isLocal = isLocalAuthEmulatorEnabled();
    setLocalAuthEmulator(isLocal);
    setAuthMethod(isLocal ? "email" : "google");
  }, []);

  // Handle the redirect callback from signInWithRedirect (in-app browsers).
  // getRedirectResult is a no-op when no redirect is pending, so it's safe to
  // call unconditionally. Errors (cancelled, network, etc.) are shown as auth errors.
  useEffect(() => {
    getRedirectResult(auth).catch((err: unknown) => {
      const message = authErrorMessage(err, "Sign-in failed.");
      if (message) setError(message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUid(u?.uid ?? null);
      setDisplayName(u?.displayName ?? "");
      setChecking(false);
      setAuthBusy(false);
      setContinuing(false);
      setBootstrapStatus("");
      setBootstrapFailed(false);
      setNotice("");

      if (!u) return;

      // Bootstrap the user profile, then auto-navigate.
      // Prefer a name we just chose during email signup (see pendingDisplayNameRef)
      // over the Auth user's displayName, which may not have propagated yet.
      const overrideDisplayName = pendingDisplayNameRef.current;
      pendingDisplayNameRef.current = null;
      setContinuing(true);
      try {
        const result = await ensureUserDoc({
          uid: u.uid,
          displayName: overrideDisplayName || (u.displayName ?? ""),
          email: u.email ?? "",
          photoURL: u.photoURL,
        });
        setBootstrapStatus(
          `Profile bootstrap: ${result.bootstrapPath}${result.created ? " (created)" : ""}`
        );
        // Auto-navigate: read the user doc and route accordingly
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        const rawData = snap.exists() ? snap.data() : null;
        const data = isRecord(rawData) ? rawData : null;
        const confirmed = hasConfirmedEntry(data);
        router.push(confirmed ? "/dashboard" : "/featured-team");
      } catch (err) {
        console.error("ensureUserDoc failed:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        const isClosedError =
          errMsg.includes("closed") || errMsg.includes("failed-precondition");
        if (isClosedError && registrationClosed) {
          await signOut(auth).catch(() => {});
          setShowClosedModal(true);
          setContinuing(false);
          return;
        }
        setBootstrapStatus("Profile bootstrap failed.");
        setBootstrapFailed(true);
        setContinuing(false);
      }
    });
    return () => unsub();
  }, [router]);

  async function handleGoogleSignIn() {
    if (authBusy) return;

    setError("");
    setNotice("");
    setAuthBusy(true);

    try {
      if (localAuthEmulator) {
        setAuthMethod("email");
        setError("Google sign-in is not available in the local Auth Emulator. Use Email for local testing.");
        return;
      }
      await signInWithGoogle(auth);
    } catch (e: unknown) {
      if (!isExpectedAuthError(e)) {
        console.error(e);
      }
      const message = authErrorMessage(e, "Sign-in failed.");
      setError(message);
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
    setNotice("");
    setAuthBusy(true);

    try {
      if (emailMode === "signup" && !registrationClosed) {
        const nextName = fullName.trim() || deriveDisplayNameFromEmail(trimmedEmail);
        // Record the chosen name *before* creating the account — the
        // onAuthStateChanged listener can fire and bootstrap the Firestore
        // profile before updateProfile() below has set it on the Auth user.
        pendingDisplayNameRef.current = nextName || null;
        const cred = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        if (nextName && cred.user.displayName !== nextName) {
          await updateProfile(cred.user, { displayName: nextName });
          setDisplayName(nextName);
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      setPassword("");
      setNotice(
        emailMode === "signup"
          ? "Account created. Continue when you are ready."
          : "Signed in."
      );
    } catch (e: unknown) {
      const code = readErrorCode(e);
      if (emailMode === "signup" && code === "auth/email-already-in-use") {
        setEmailMode("signin");
        setError("This email already has an account. Sign in below.");
        setAuthBusy(false);
        return;
      }
      if (!isExpectedAuthError(e)) {
        console.error(e);
      }
      setError(
        (localAuthEmulator ? localEmailAuthErrorMessage : authErrorMessage)(
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

  async function handlePasswordReset() {
    if (authBusy) return;

    const trimmedEmail = email.trim();
    if (!looksLikeEmail(trimmedEmail)) {
      setError("Enter your email address first.");
      return;
    }

    setError("");
    setNotice("");
    setAuthBusy(true);

    try {
      const actionCodeSettings = localAuthEmulator
        ? undefined
        : { url: `${window.location.origin}/`, handleCodeInApp: false };
      await sendPasswordResetEmail(auth, trimmedEmail, actionCodeSettings);
      setNotice(
        localAuthEmulator
          ? "Password reset requested. In local testing, check the Auth Emulator UI for the reset link."
          : "Reset email sent — check your inbox and spam folder. It may take a minute to arrive."
      );
    } catch (e: unknown) {
      if (!isExpectedAuthError(e)) {
        console.error(e);
      }
      setError(authErrorMessage(e, "Password reset failed."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setNotice("");

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
      const confirmed = hasConfirmedEntry(data);

      const nextPath = confirmed ? "/dashboard" : "/featured-team";

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
          <div className="inline-block w-20 h-20 rounded-2xl mb-4 overflow-hidden">
            <img
              src={BRANDING.logo512Src}
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

        {notice ? (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 text-center">
            {notice}
          </div>
        ) : null}

        {signedIn && bootstrapFailed ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
            Something went wrong setting up your profile. Try the button below or refresh the page.
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {!signedIn ? (
            <>
              {authMethod !== "email" && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-3 min-h-11 h-11 font-semibold"
                  onClick={() => setShowHowItWorks((prev) => !prev)}
                >
                  {showHowItWorks ? "Hide quick help" : "How this game works"}
                </Button>
                {showHowItWorks ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-left space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      1. Sign in.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      2. Pick one Star Team.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      3. Your Star Team gets double points.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      4. You get 5 Drawn Teams — a fair mix of favourites and underdogs.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      5. Watch your score and rank update as matches finish.
                    </p>
                  </div>
                ) : null}
              </div>
              )}

              {localAuthEmulator ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 text-center">
                  Local testing is using the Firebase Auth Emulator. Real Google
                  or production Firebase accounts will not exist here unless they
                  are created locally. For a full Google/email/password-reset
                  rehearsal, restart with npm run dev:live-auth.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setAuthMethod("google");
                  }}
                  disabled={localAuthEmulator}
                  className={[
                    "min-h-11 h-11 rounded-lg text-sm font-semibold transition-colors",
                    authMethod === "google"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:text-foreground",
                    localAuthEmulator ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {localAuthEmulator ? "Google (live only)" : "Google"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setAuthMethod("email");
                  }}
                  className={[
                    "min-h-11 h-11 rounded-lg text-sm font-semibold transition-colors",
                    authMethod === "email"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:text-foreground",
                  ].join(" ")}
                >
                  Email
                </button>
              </div>

              {authMethod === "google" ? (
                <div className="space-y-3">
                  {localAuthEmulator ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 text-center">
                      Local testing uses the Auth Emulator. Use Email sign-in here.
                    </div>
                  ) : null}
                  <Button
                    onClick={handleGoogleSignIn}
                    disabled={checking || authBusy || localAuthEmulator}
                    className="w-full h-12 text-base font-semibold"
                    size="lg"
                  >
                    {checking
                      ? "Checking..."
                      : authBusy
                        ? "Please wait..."
                        : localAuthEmulator
                          ? "Google unavailable locally"
                          : "Sign in with Google"}
                  </Button>
                  {registrationClosed && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowClosedModal(true)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Sign up
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form
                  className="space-y-2.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleEmailAuth();
                  }}
                >
                  {emailMode === "signup" && !registrationClosed ? (
                    <div className="space-y-1">
                      <Label htmlFor="auth-full-name" className="text-xs">Full name (optional)</Label>
                      <Input
                        id="auth-full-name"
                        type="text"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        autoComplete="name"
                        className="h-9 text-sm"
                      />
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <Label htmlFor="auth-email" className="text-xs">Email</Label>
                    <Input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="auth-password" className="text-xs">Password</Label>
                    <Input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={
                        emailMode === "signup" ? "new-password" : "current-password"
                      }
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={checking || authBusy}
                    className="w-full h-10 text-sm font-semibold"
                  >
                    {authBusy
                      ? "Please wait..."
                      : emailMode === "signup"
                        ? "Create Account"
                        : "Sign in with Email"}
                  </Button>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    {emailMode === "signin" ? (
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={checking || authBusy}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Forgot password?
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={() => {
                        if (registrationClosed) {
                          setShowClosedModal(true);
                        } else {
                          setError("");
                          setNotice("");
                          setEmailMode((prev) =>
                            prev === "signup" ? "signin" : "signup"
                          );
                        }
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
                    >
                      {registrationClosed
                        ? "Sign up"
                        : emailMode === "signup"
                          ? "Already have an account"
                          : "Create account"}
                    </button>
                  </div>
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
                {continuing ? "Taking you in…" : "Continue"}
              </Button>
              {bootstrapFailed ? (
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full h-11 text-sm font-semibold"
                >
                  Sign Out
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Registration-closed modal — shown when someone taps "Sign up" after the deadline */}
      {showClosedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowClosedModal(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-[var(--ff-bg-chrome)] p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-[var(--ff-bg-card)]">
                <LockKeyhole className="h-5 w-5 text-[var(--ff-fg-secondary)]" />
              </div>
              <h2 className="text-base font-semibold text-[var(--ff-fg-primary)]">
                Registration is closed
              </h2>
              <p className="text-sm text-[var(--ff-fg-secondary)] leading-relaxed">
                The Cup Draw 2026 sweepstakes kicked off on 11 June. The entry
                window closed the moment the first ball was played — it
                wouldn&apos;t be fair to let new players join once the scores
                are already moving.
              </p>
              <p className="text-sm text-[var(--ff-fg-secondary)]">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setShowClosedModal(false);
                    setEmailMode("signin");
                  }}
                  className="font-medium text-[var(--ff-fg-primary)] underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  Sign in here.
                </button>
              </p>
            </div>
            <button
              onClick={() => setShowClosedModal(false)}
              className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-[var(--ff-fg-secondary)] hover:bg-white/5 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
