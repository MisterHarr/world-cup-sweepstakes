"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";

import { db, functions } from "@/lib/firebase";
import { useAuthGuard } from "@/lib/useAuthGuard";

import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Department = "Primary" | "Secondary" | "Admin";

function isAlreadySetError(message: string) {
  const m = (message || "").toLowerCase();
  return (
    m.includes("department already set") ||
    m.includes("already set") ||
    m.includes("cannot be changed")
  );
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
        const dept = snap.exists() ? (snap.data() as any)?.department : null;

        if (!cancelled && dept) {
          router.replace(next);
          return;
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message ?? "Failed to check department.");
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
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Failed to set department.";

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

  const departments: { value: Department; label: string; description: string }[] = [
    { value: "Primary", label: "Primary", description: "Primary school staff" },
    { value: "Secondary", label: "Secondary", description: "Secondary school staff" },
    { value: "Admin", label: "Admin", description: "Operations / Admin staff" },
  ];

  return (
    <AppShell user={user}>
      <div className="min-h-[calc(100vh-73px)] flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-lg relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <Badge variant="outline" className="mb-4">
              One-time Setup
            </Badge>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Choose Your Department
            </h1>
            <p className="text-muted-foreground">
              This selection can only be set once and cannot be changed later.
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-2xl shadow-black/20">
            {/* Loading State */}
            {(checkingExisting || submitting) && (
              <div
                className="mb-4 p-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground flex items-center gap-2"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                {checkingExisting
                  ? "Checking your existing profile..."
                  : "Saving your selection..."}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div
                className="mb-4 p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Department Options */}
            <fieldset className="space-y-3 mb-6">
              <legend className="sr-only">Select your department</legend>
              {departments.map((dept) => (
                <label
                  key={dept.value}
                  className={`
                    w-full rounded-xl border p-4 text-left transition-all duration-200 block
                    ${
                      selected === dept.value
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border bg-card hover:bg-accent"
                    }
                    ${
                      checkingExisting || submitting
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    }
                    focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary
                  `}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-foreground">{dept.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {dept.description}
                      </div>
                    </div>
                    {selected === dept.value && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-primary-foreground"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </fieldset>

            {/* Action Button */}
            <Button
              onClick={handleConfirm}
              disabled={checkingExisting || submitting}
              className="w-full h-12"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                "Confirm & Continue →"
              )}
            </Button>

            {/* Next Path Info */}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Next: <span className="font-mono text-foreground">{next}</span>
            </p>
          </div>
        </div>
      </div>
    </AppShell>
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
