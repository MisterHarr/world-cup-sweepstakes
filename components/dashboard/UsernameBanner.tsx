"use client";

import { useEffect, useState } from "react";
import { X, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Pre-fill the input with the Google display name. */
  defaultValue?: string;
  /** Called with the chosen username when saved; can throw to surface an error. */
  onSave: (username: string) => Promise<void>;
  /** Called when the user taps the X to dismiss for this session. */
  onDismiss: () => void;
  /**
   * Controlled open state — lets a parent force the modal open (e.g. from a
   * top-bar button).  When undefined the component manages its own open state.
   */
  forceOpen?: boolean;
  onForceOpenChange?: (open: boolean) => void;
  /** Hide the banner strip — render only the modal (used when opened via top bar after dismissal). */
  hideBanner?: boolean;
  /**
   * The name currently shown for this user on the leaderboard (i.e. what
   * everyone else sees right now). When this resolves to the literal string
   * "Anonymous" — e.g. a signup hiccup meant no name was ever recorded — the
   * banner switches to a more pointed warning so the player understands
   * they're literally showing up as "Anonymous" to everyone else (rather
   * than reading this as a routine "personalize your profile" suggestion),
   * and nudges them to pick literally any name or nickname instead — no
   * pressure to reveal a real identity; a made-up handle is fine.
   */
  currentPublicName?: string;
}

const MAX = 30;
const MIN = 2;

export function UsernameBanner({
  defaultValue = "",
  onSave,
  onDismiss,
  forceOpen,
  onForceOpenChange,
  hideBanner = false,
  currentPublicName,
}: Props) {
  const isStuckAnonymous = (currentPublicName ?? "").trim().toLowerCase() === "anonymous";
  const [internalOpen, setInternalOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sync value when defaultValue changes (e.g. Google name loads async)
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const modalOpen = forceOpen !== undefined ? forceOpen : internalOpen;
  function setModalOpen(open: boolean) {
    if (forceOpen !== undefined) {
      onForceOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
  }

  async function handleSave() {
    const trimmed = value.trim();
    if (trimmed.length < MIN) {
      setError(`Must be at least ${MIN} characters.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed);
      setModalOpen(false);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Failed to save — please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Banner — hidden when opened from top bar after user dismissed it */}
      {!hideBanner && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm",
            isStuckAnonymous
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-primary/30 bg-primary/10"
          )}
        >
          {isStuckAnonymous && (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          )}
          <span className="flex-1 text-[var(--ff-fg-primary)]">
            {isStuckAnonymous ? (
              <>
                <span className="font-medium">You&apos;re showing as &quot;Anonymous&quot;</span>
                <span className="text-[var(--ff-fg-secondary)]">
                  {" "}on the leaderboard — pick any name or nickname you like.
                </span>
              </>
            ) : (
              <>
                <span className="font-medium">Set your display name</span>
                <span className="text-[var(--ff-fg-secondary)]">
                  {" "}— how others see you on the leaderboard.
                </span>
              </>
            )}
          </span>
          <button
            onClick={() => { setValue(defaultValue); setError(""); setModalOpen(true); }}
            className={cn(
              "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0",
              isStuckAnonymous
                ? "bg-amber-500 text-black hover:bg-amber-400"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Set name
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-[var(--ff-fg-secondary)] hover:text-[var(--ff-fg-primary)] transition-colors shrink-0 -mr-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-[var(--ff-bg-chrome)] p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--ff-fg-primary)] mb-1">
              {isStuckAnonymous ? "Pick a name — you're currently “Anonymous”" : "Your display name"}
            </h2>
            <p className="text-sm text-[var(--ff-fg-secondary)] mb-3">
              {isStuckAnonymous
                ? "You're currently showing as “Anonymous” on the leaderboard. Pick any name or nickname — whatever you like."
                : "Shown on the leaderboard — not your Google account name."}
            </p>
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Choose carefully — this can only be set once and cannot be changed later.
            </div>

            <div className="relative mb-1">
              <input
                autoFocus
                type="text"
                maxLength={MAX}
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                placeholder="e.g. GoalMachine FC"
                className={cn(
                  "w-full rounded-xl border bg-[var(--ff-bg-app)] px-4 py-2.5 text-sm text-[var(--ff-fg-primary)] placeholder:text-[var(--ff-fg-secondary)]/50 outline-none focus:ring-2 transition-all",
                  error
                    ? "border-destructive focus:ring-destructive/30"
                    : "border-border focus:ring-primary/30"
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--ff-fg-secondary)]/60 pointer-events-none">
                {value.trim().length}/{MAX}
              </span>
            </div>

            {error && (
              <p className="text-xs text-destructive mb-3">{error}</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-[var(--ff-fg-secondary)] hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || value.trim().length < MIN}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
