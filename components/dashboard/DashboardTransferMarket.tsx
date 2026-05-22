"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search, Zap } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MarketTeam = {
  id: string;
  name: string;
  status?: "active" | "eliminated" | "available";
  trend?: "up" | "down" | "stable";
  points?: number;
  flagUrl?: string;
};

export type TradeResult = {
  ok: boolean;
  message?: string;
};

function Flag22({ team }: { team: MarketTeam }) {
  const code = team.id.slice(0, 2).toUpperCase();
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt=""
        className="h-[22px] w-[22px] shrink-0 rounded-sm border border-[var(--ff-hairline)] object-cover"
      />
    );
  }
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm border border-[var(--ff-hairline)] bg-black/25 font-ff-ui text-[9px] font-bold text-[var(--ff-fg-faint)]">
      {code}
    </span>
  );
}

function trendGlyph(t: MarketTeam["trend"]) {
  if (t === "up") return "↑";
  if (t === "down") return "↓";
  return "—";
}

function trendClass(t: MarketTeam["trend"]) {
  if (t === "up") return "text-[var(--ff-accent-text)]";
  if (t === "down") return "text-[var(--ff-danger)]";
  return "text-[var(--ff-fg-quieter)]";
}

const DashboardTransferMarket = ({
  squad = [],
  market = [],
  userScore = 0,
  penalty = 15,
  transferWindowOpen,
  transferWindowLabel,
  transfersRemaining = 0,
  transferBusy = false,
  transferError = "",
  transferSuccess = "",
  onTrade = async () => ({ ok: false, message: "Transfer handler is not configured." }),
}: {
  squad: MarketTeam[];
  market: MarketTeam[];
  userScore: number;
  penalty?: number;
  transferWindowOpen: boolean;
  transferWindowLabel: string;
  transfersRemaining?: number;
  transferBusy?: boolean;
  transferError?: string;
  transferSuccess?: string;
  onTrade?: (p: { drop: MarketTeam; pickup: MarketTeam }) => Promise<TradeResult>;
}) => {
  const releaseTeams = squad;
  const availableTeams = market;

  const [selectedDrop, setSelectedDrop] = useState<MarketTeam | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<MarketTeam | null>(null);
  const [search, setSearch] = useState("");
  const [confirmProgress, setConfirmProgress] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmPress, setConfirmPress] = useState(false);
  const confirmProgressRef = useRef(0);

  const projectedScore = selectedDrop && selectedPickup ? userScore - penalty : userScore;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearConfirmInterval = () => {
    if (intervalRef.current === null) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };
  const resetConfirmState = () => {
    clearConfirmInterval();
    confirmProgressRef.current = 0;
    setIsConfirmed(false);
    setConfirmProgress(0);
    setConfirmPress(false);
  };

  const canExecuteTrade =
    Boolean(selectedDrop && selectedPickup) &&
    transferWindowOpen &&
    transfersRemaining > 0 &&
    !transferBusy &&
    !isSubmitting;
  const tradeButtonDisabled = !canExecuteTrade;
  const canPickReplacement = Boolean(selectedDrop);

  const executeTrade = async (trade: { drop: MarketTeam; pickup: MarketTeam }) => {
    setIsSubmitting(true);
    try {
      const result = await onTrade(trade);
      if (result?.ok) {
        setIsConfirmed(true);
        return;
      }
      setIsConfirmed(false);
      setConfirmProgress(0);
    } catch {
      setIsConfirmed(false);
      setConfirmProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startConfirm = () => {
    if (!selectedDrop || !selectedPickup || !canExecuteTrade || isConfirmed) return;
    setConfirmPress(true);

    const trade = {
      drop: selectedDrop,
      pickup: selectedPickup,
    };

    clearConfirmInterval();
    intervalRef.current = setInterval(() => {
      const next = Math.min(confirmProgressRef.current + 4, 100);
      confirmProgressRef.current = next;
      setConfirmProgress(next);

      if (next >= 100) {
        clearConfirmInterval();
        void executeTrade(trade);
      }
    }, 20);
  };

  const stopConfirm = () => {
    setConfirmPress(false);
    if (isConfirmed || isSubmitting) return;
    clearConfirmInterval();
    confirmProgressRef.current = 0;
    setConfirmProgress(0);
  };

  useEffect(() => {
    return () => {
      clearConfirmInterval();
    };
  }, []);

  const filteredAvailable = availableTeams.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase())
  );

  const transferCost = selectedPickup ? penalty : 0;

  const scoreFmt = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(n);

  const acknowledgeSuccess = () => {
    setIsConfirmed(false);
    setSelectedDrop(null);
    setSelectedPickup(null);
    setSearch("");
    resetConfirmState();
  };

  const costCaption =
    transferCost === 0 ? "No cost" : `−${penalty} pts cost`;

  const transferActionPanel = (
    <div className="rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[#0f1115] px-3.5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-ff-ui text-[13px]">
            {selectedDrop ? (
              <>
                <Flag22 team={selectedDrop} />
                <span className="truncate font-semibold text-[#ef4444]">{selectedDrop.name}</span>
                <span className="text-[var(--ff-fg-muted)]">→</span>
                {selectedPickup ? (
                  <>
                    <Flag22 team={selectedPickup} />
                    <span className="truncate font-semibold text-[var(--ff-accent-text)]">
                      {selectedPickup.name}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm border border-dashed border-[var(--ff-hairline-strong)] text-[10px] text-[var(--ff-fg-faint)]">
                      ?
                    </span>
                    <span className="text-[var(--ff-fg-faint)]">Select…</span>
                  </>
                )}
              </>
            ) : (
              <p className="text-[13px] leading-snug text-[var(--ff-fg-quieter)]">
                Choose someone to release on the left, then pick a replacement on the right.
              </p>
            )}
          </div>
          <p className="mt-1 font-ff-ui text-[10px] text-[#3d4a58]">
            Projected: {scoreFmt(projectedScore)} pts · {costCaption}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[200px]">
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg border px-2.5 py-2 font-ff-ui text-[10px] leading-snug",
              !transferWindowOpen
                ? "border-[var(--ff-danger)]/30 bg-[rgba(239,68,68,0.08)] text-[var(--ff-danger)]"
                : transfersRemaining <= 0
                  ? "border-[var(--ff-gold)]/30 bg-[rgba(245,158,11,0.08)] text-[var(--ff-gold)]"
                  : "border-[var(--ff-hairline)] bg-black/20 text-[var(--ff-fg-quieter)]"
            )}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>
              {!transferWindowOpen
                ? "Transfers are closed."
                : transfersRemaining <= 0
                  ? "No transfers remaining."
                  : transfersRemaining === 1
                    ? "Final transfer — cost applies on confirm."
                    : "Hold confirm to trade."}
            </p>
          </div>

          <button
            type="button"
            disabled={tradeButtonDisabled}
            onMouseDown={startConfirm}
            onMouseUp={stopConfirm}
            onMouseLeave={stopConfirm}
            onTouchStart={startConfirm}
            onTouchEnd={stopConfirm}
            className={cn(
              "relative w-full overflow-hidden rounded-[10px] border py-3 font-ff-ui text-[11px] font-semibold uppercase tracking-wide select-none",
              "transition-[transform,background-color,border-color,color] duration-[var(--ff-confirm-press-ms,150ms)] ease-out motion-reduce:transition-none",
              tradeButtonDisabled
                ? "cursor-not-allowed border-[var(--ff-hairline)] bg-transparent text-[#3d4a58]"
                : confirmPress
                  ? "scale-95 cursor-pointer border-[#4ade80] bg-[#4ade80] text-zinc-950"
                  : "cursor-pointer border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] text-[var(--ff-accent-text)]"
            )}
          >
            {!tradeButtonDisabled ? (
              <span
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-75 ease-linear",
                  confirmPress ? "bg-black/35" : "bg-[var(--ff-accent-text)]"
                )}
                style={{
                  width: `${confirmProgress}%`,
                  opacity: confirmPress ? 0.55 : 0.35,
                }}
              />
            ) : null}
            <span className="relative z-[1]">
              {isSubmitting || transferBusy
                ? "Working…"
                : confirmProgress > 0
                  ? "Hold…"
                  : !transferWindowOpen
                    ? "Closed"
                    : transfersRemaining <= 0
                      ? "None left"
                      : !selectedDrop || !selectedPickup
                        ? "Pick teams"
                        : "Hold to confirm"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "relative min-h-0 pb-6 font-ff-ui text-[var(--ff-fg-primary)] lg:flex lg:min-h-0 lg:flex-col",
        selectedDrop && !isConfirmed && "max-md:pb-44"
      )}
    >
      {transferError ? (
        <div className="mb-4 rounded-[14px] border border-[var(--ff-danger)]/35 bg-[rgba(239,68,68,0.08)] px-4 py-3 font-ff-ui text-sm text-[var(--ff-danger)]">
          {transferError}
        </div>
      ) : null}
      {transferSuccess && !isConfirmed ? (
        <div className="mb-4 rounded-[14px] border border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] px-4 py-3 font-ff-ui text-sm text-[var(--ff-accent-text)]">
          {transferSuccess}
        </div>
      ) : null}

      {isConfirmed ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <div className="ff-transfer-done-icon text-[56px] leading-none" aria-hidden>
            ✅
          </div>
          <h2 className="font-ff-display mt-5 text-[32px] font-extrabold tracking-tight text-[var(--ff-fg-primary)]">
            Transfer Done
          </h2>
          <p className="mt-2 max-w-sm font-ff-ui text-sm text-[var(--ff-fg-muted)]">
            {selectedDrop?.name ?? ""} → {selectedPickup?.name ?? ""}
          </p>
          <button
            type="button"
            onClick={acknowledgeSuccess}
            className="mt-8 rounded-[10px] border border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] px-7 py-[11px] font-ff-ui text-[11px] font-semibold uppercase tracking-wide text-[var(--ff-accent-text)] transition-transform motion-reduce:transition-none active:scale-95"
          >
            Back
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex shrink-0 flex-wrap items-start gap-2">
            <Zap
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                transferWindowOpen ? "text-[var(--ff-gold)]" : "text-[var(--ff-danger)]"
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="font-ff-display text-[20px] font-bold leading-tight text-[#f59e0b]">
                {transferWindowOpen ? "Transfer Window Open" : "Transfer Window Closed"}
              </p>
              <p className="mt-1 font-ff-ui text-[11px] text-[#4b5563]">
                {transfersRemaining} transfer{transfersRemaining === 1 ? "" : "s"} remaining · Current score:{" "}
                {scoreFmt(userScore)} pts
              </p>
              <p className="mt-0.5 font-ff-ui text-[11px] text-[var(--ff-fg-quiet)]">{transferWindowLabel}</p>
              <Link
                href="/transfer-history"
                className="mt-1 inline-block font-ff-ui text-[10px] font-medium text-[var(--ff-accent-text)] underline underline-offset-2"
              >
                View transfer history
              </Link>
            </div>
          </div>

          <div className="flex min-h-0 flex-col lg:min-h-0 lg:flex-1">
            <div className="mb-6 flex min-h-0 max-h-none flex-col gap-6 lg:mb-0 lg:max-h-[min(640px,calc(100dvh-15rem))] lg:flex-1 lg:flex-row lg:items-stretch lg:gap-6 lg:overflow-hidden">
            <div className="lg:flex lg:min-h-0 lg:w-[38%] lg:max-w-sm lg:shrink-0 lg:flex-col">
              <p className="mb-2 font-ff-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3d4a58]">
                ① Release a team
              </p>
              {releaseTeams.length === 0 ? (
                <div className="rounded-xl border border-[var(--ff-hairline)] bg-[var(--ff-bg-card-alt)] p-8 text-center font-ff-ui text-sm text-[var(--ff-fg-quiet)]">
                  No squad teams available.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 lg:max-h-full lg:auto-rows-min lg:grid-cols-2 lg:gap-2 lg:overflow-y-auto xl:grid-cols-3">
                  {releaseTeams.map((team) => {
                    const selected = selectedDrop?.id === team.id;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          setSelectedDrop(team);
                          resetConfirmState();
                        }}
                        className={cn(
                          "flex flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-transform duration-150 motion-reduce:transition-none",
                          "bg-[#0f1115]",
                          selected
                            ? "scale-[0.96] border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)]"
                            : "border-[rgba(255,255,255,0.06)] hover:border-[var(--ff-hairline-strong)]"
                        )}
                      >
                        <Flag22 team={team} />
                        <p
                          className={cn(
                            "mt-1 line-clamp-2 font-ff-ui text-[11px] font-semibold leading-tight",
                            selected ? "text-[#ef4444]" : "text-[var(--ff-fg-secondary)]"
                          )}
                        >
                          {team.name}
                        </p>
                        <p className="font-ff-display text-[15px] font-bold leading-none text-[var(--ff-fg-primary)]">
                          {scoreFmt(team.points ?? 0)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <section
              className={cn(
                "flex min-h-0 flex-col transition-opacity duration-200 motion-reduce:transition-none lg:min-h-0 lg:flex-1",
                canPickReplacement ? "opacity-100" : "pointer-events-none opacity-[0.35]"
              )}
              aria-disabled={!canPickReplacement}
            >
              <p className="mb-2 font-ff-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3d4a58]">
                ② Choose replacement
              </p>
              <div className="mb-3 flex shrink-0 items-center gap-2 border-b border-[rgba(255,255,255,0.07)] pb-2">
                <Search className="h-4 w-4 shrink-0 text-[var(--ff-fg-faint)]" aria-hidden />
                <Input
                  placeholder="Search teams…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={!canPickReplacement}
                  className="h-9 border-0 bg-transparent px-0 font-ff-ui text-[13px] text-[var(--ff-fg-secondary)] shadow-none outline-none focus-visible:ring-0 disabled:opacity-50"
                />
              </div>

              <div className="max-h-[min(50vh,420px)] min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card)] lg:max-h-none">
                {filteredAvailable.length === 0 ? (
                  <div className="p-8 text-center font-ff-ui text-sm text-[var(--ff-fg-quiet)]">No teams found.</div>
                ) : (
                  filteredAvailable.map((team) => {
                    const selected = selectedPickup?.id === team.id;
                    const trend = team.trend ?? "stable";
                    return (
                      <button
                        key={team.id}
                        type="button"
                        disabled={!canPickReplacement}
                        onClick={() => {
                          if (!canPickReplacement) return;
                          setSelectedPickup(team);
                          resetConfirmState();
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 border-b border-[var(--ff-hairline-muted)] px-3 py-2.5 text-left transition-colors last:border-b-0",
                          !canPickReplacement && "cursor-not-allowed",
                          selected
                            ? "rounded-r-lg border-l-[3px] border-l-[var(--ff-accent-text)] bg-[var(--ff-accent-dim)] pl-[9px]"
                            : "border-l-[3px] border-l-transparent hover:bg-white/[0.03]"
                        )}
                      >
                        <Flag22 team={team} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-ff-ui text-[13px] font-semibold text-[var(--ff-fg-tertiary)]">
                            {team.name}
                          </p>
                          <p className="truncate font-ff-ui text-[10px] text-[var(--ff-fg-faint)]">{team.id}</p>
                        </div>
                        <span
                          className={cn("w-4 shrink-0 text-center font-ff-ui text-sm font-bold", trendClass(trend))}
                        >
                          {trendGlyph(trend)}
                        </span>
                        <span className="w-10 shrink-0 text-right font-ff-display text-base font-bold text-[var(--ff-fg-secondary)]">
                          {scoreFmt(team.points ?? 0)}
                        </span>
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                            selected
                              ? "border-[var(--ff-accent-text)] bg-[var(--ff-accent-text)]"
                              : "border-[var(--ff-fg-quieter)]"
                          )}
                          aria-hidden
                        >
                          {selected ? <span className="h-1.5 w-1.5 rounded-full bg-black" /> : null}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </div>
          </div>
        </>
      )}

      {!isConfirmed ? (
        <>
          <div className="relative z-10 mx-auto mt-4 hidden w-full max-w-4xl shrink-0 md:block">
            {transferActionPanel}
          </div>
          {selectedDrop ? (
            <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom,0px))] z-40 border-t border-[var(--ff-hairline)] bg-[var(--ff-bg-blur)] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[20px] md:hidden">
              <div className="mx-auto max-w-4xl">{transferActionPanel}</div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default DashboardTransferMarket;
