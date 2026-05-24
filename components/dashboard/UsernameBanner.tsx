"use client";

import { useState } from "react";
import { X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Pre-fill the input with the Google display name. */
  defaultValue?: string;
  /** Called with the chosen username when saved; can throw to surface an error. */
  onSave: (username: string) => Promise<void>;
  /** Called when the user taps the X to dismiss for this session. */
  onDismiss: () => void;
}

const MAX = 30;
const MIN = 2;

export function UsernameBanner({ defaultValue = "", onSave, onDismiss }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      {/* Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
        <span className="flex-1 text-[var(--ff-fg-primary)]">
          <span className="font-medium">Set your display name</span>
          <span className="text-[var(--ff-fg-secondary)]">
            {" "}— how others see you on the leaderboard.
          </span>
        </span>
        <button
          onClick={() => { setValue(defaultValue); setError(""); setModalOpen(true); }}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
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

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-[var(--ff-bg-chrome)] p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-[var(--ff-fg-primary)] mb-1">
              Your display name
            </h2>
            <p className="text-sm text-[var(--ff-fg-secondary)] mb-5">
              Shown on the leaderboard — not your Google account name.
            </p>

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
