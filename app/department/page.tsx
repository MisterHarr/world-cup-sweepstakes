"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { db, functions } from "@/lib/firebase";
import { normalizeDepartment, type Department } from "@/lib/departments";
import { useAuthGuard } from "@/lib/useAuthGuard";

import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { Button } from "@/components/ui/button";

function isAlreadySetError(message: string) {
  const m = (message || "").toLowerCase();
  return (
    m.includes("department already set") ||
    m.includes("already set") ||
    m.includes("cannot be changed")
  );
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function DepartmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(
    () => searchParams.get("next") || "/featured-team",
    [searchParams]
  );

  const { user, authLoading } = useAuthGuard();
  const uid = user?.uid ?? null;

  const [selected, setSelected] = useState<Department>("Primary");
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  // If signed out and auth resolved: redirect away
  useEffect(() => {
    if (authLoading) return;
    if (!uid) {
      router.replace("/login");
    }
  }, [authLoading, uid, router]);

  // On load: check if department already exists
  useEffect(() => {
    let cancelled = false;

    async function checkExisting(currentUid: string) {
      setError("");
      setCheckingExisting(true);

      try {
        const snap = await getDoc(doc(db, "users", currentUid));
        const rawData = snap.exists() ? snap.data() : null;
        const data = isRecord(rawData) ? rawData : null;
        const dept = normalizeDepartment(data?.department);

        if (!cancelled && dept) {
          router.replace(next);
          return;
        }
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled) {
          setError(friendlyErrorMessage(e, "Failed to check department."));
        }
      } finally {
        if (!cancelled) setCheckingExisting(false);
      }
    }

    if (authLoading) return;
    if (!uid) return;

    checkExisting(uid);

    return () => {
      cancelled = true;
    };
  }, [authLoading, uid, router, next]);

  async function handleConfirm() {
    setError("");

    if (authLoading || !uid) return;

    setSubmitting(true);
    try {
      const setDepartment = httpsCallable(functions, "setDepartment");
      await setDepartment({ department: selected });
      router.replace(next);
    } catch (e: unknown) {
      console.error(e);
      const msg = friendlyErrorMessage(e, "Failed to set department.");

      if (isAlreadySetError(msg)) {
        router.replace(next);
        return;
      }

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Safe conditional render AFTER hooks
  if (authLoading) return null;
  if (!uid) return null;

  const departments: { value: Department; label: string }[] = [
    { value: "Primary", label: "Primary" },
    { value: "Secondary", label: "Secondary" },
    { value: "Admin", label: "Ops/Admin" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/25 backdrop-blur-xl p-6 sm:p-8 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="text-center mb-7">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Choose Your Department
          </h1>
        </div>

        {(checkingExisting || submitting) && (
          <div
            className="mb-4 rounded-xl border border-border bg-white/5 px-3 py-2 text-sm text-foreground flex items-center justify-center gap-2"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            {checkingExisting ? "Checking profile..." : "Saving..."}
          </div>
        )}

        {error && (
          <div
            className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive text-center"
            role="alert"
          >
            {error}
          </div>
        )}

        <fieldset className="space-y-3 mb-6">
          <legend className="sr-only">Select your department</legend>
          {departments.map((dept) => (
            <label
              key={dept.value}
              className={[
                "w-full rounded-2xl border px-4 py-5 sm:py-6 transition-all duration-200 block text-center",
                selected === dept.value
                  ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                  : "border-white/15 bg-white/[0.04] hover:bg-white/[0.08]",
                checkingExisting || submitting
                  ? "opacity-60 cursor-not-allowed"
                  : "cursor-pointer",
                "focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary",
              ].join(" ")}
            >
              <input
                type="radio"
                name="department"
                value={dept.value}
                checked={selected === dept.value}
                onChange={() => setSelected(dept.value)}
                disabled={checkingExisting || submitting}
                className="sr-only"
              />
              <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {dept.label}
              </span>
            </label>
          ))}
        </fieldset>

        <Button
          onClick={handleConfirm}
          disabled={checkingExisting || submitting}
          className="w-full h-14 text-base sm:text-lg font-bold"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Confirming...
            </>
          ) : (
            "Confirm and Continue"
          )}
        </Button>
      </div>
    </div>
  );
}

export default function DepartmentPage() {
  return (
    <Suspense fallback={
      <div
        className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 flex items-center justify-center"
        role="status"
        aria-label="Loading page"
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <DepartmentPageContent />
    </Suspense>
  );
}
