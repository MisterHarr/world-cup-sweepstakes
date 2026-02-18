"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Search, Shield, Zap } from "lucide-react";

import { Input } from "@/components/ui/input";

export type MarketTeam = {
  id: string;
  name: string;
  status?: "active" | "eliminated" | "available";
  trend?: "up" | "down" | "stable";
  points?: number;
};

export type TradeResult = {
  ok: boolean;
  message?: string;
};

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

  const projectedScore = selectedDrop && selectedPickup ? userScore - penalty : userScore;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearConfirmInterval = () => {
    if (intervalRef.current === null) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };
  const resetConfirmState = () => {
    clearConfirmInterval();
    setIsConfirmed(false);
    setConfirmProgress(0);
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

    const trade = {
      drop: selectedDrop,
      pickup: selectedPickup,
    };

    clearConfirmInterval();
    intervalRef.current = setInterval(() => {
      setConfirmProgress((prev) => {
        const next = Math.min(prev + 4, 100);
        if (next >= 100) {
          clearConfirmInterval();
          void executeTrade(trade);
        }
        return next;
      });
    }, 20);
  };

  const stopConfirm = () => {
    if (isConfirmed || isSubmitting) return;
    clearConfirmInterval();
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

  return (
    <div className="h-full flex flex-col space-y-6">
      <div
        className={[
          "rounded-2xl border p-5",
          transferWindowOpen
            ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
            : "bg-destructive/10 border-destructive/30",
        ].join(" ")}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={[
                "w-11 h-11 rounded-xl flex items-center justify-center",
                transferWindowOpen ? "bg-amber-500/20" : "bg-destructive/20",
              ].join(" ")}
            >
              <Zap className={`w-5 h-5 ${transferWindowOpen ? "text-amber-400" : "text-destructive"}`} />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {transferWindowOpen ? "Transfer Window Active" : "Transfer Window Closed"}
              </p>
              <p className="text-sm text-muted-foreground">{transferWindowLabel}</p>
              <p className="text-xs text-muted-foreground">
                {transfersRemaining} transfer{transfersRemaining === 1 ? "" : "s"} remaining
              </p>
              <Link
                href="/transfer-history"
                className="inline-block text-xs text-primary hover:text-primary/80 underline underline-offset-2"
              >
                View transfer history
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Current Points</p>
            <p className="font-mono text-3xl font-bold text-foreground">{userScore}</p>
          </div>
        </div>
      </div>

      {transferError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {transferError}
        </div>
      )}
      {transferSuccess && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {transferSuccess}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </div>
              <h3 className="text-lg font-bold text-foreground">Select Team to Release</h3>
            </div>
            {releaseTeams.length === 0 ? (
              <div className="rounded-xl border border-border bg-black/10 p-10 text-center text-sm italic text-muted-foreground/80">
                No squad teams available.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {releaseTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      setSelectedDrop(team);
                      resetConfirmState();
                    }}
                    className={[
                      "rounded-xl border p-4 text-left transition-all",
                      selectedDrop?.id === team.id
                        ? "border-rose-500/40 bg-rose-500/15 shadow-lg ring-1 ring-rose-500/20"
                        : "border-border bg-black/10 hover:border-border/80",
                    ].join(" ")}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/90 text-xs font-bold text-foreground/80">
                          {team.id.slice(0, 3).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{team.name}</p>
                          <p className="text-xs text-muted-foreground">{team.id}</p>
                        </div>
                      </div>
                      {selectedDrop?.id === team.id && (
                        <span className="rounded-md border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                          OUT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span
                        className={
                          team.status === "eliminated" ? "text-destructive" : "text-muted-foreground"
                        }
                      >
                        {(team.status ?? "active").toUpperCase()}
                      </span>
                      <span className="font-mono text-foreground/80">{team.points ?? 0} pts</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
            <div className="mb-4 flex items-center gap-3">
              <div
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  canPickReplacement
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                2
              </div>
              <h3 className="text-lg font-bold text-foreground">Choose Replacement</h3>
            </div>

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search available teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 pl-10"
                disabled={!canPickReplacement}
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-black/10">
              <div className="hidden grid-cols-[minmax(0,1.6fr)_110px_80px_110px] gap-3 border-b border-border bg-white/5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
                <span>Team</span>
                <span>Trend</span>
                <span className="text-right">Points</span>
                <span className="text-right">Action</span>
              </div>
              <div className="max-h-[430px] overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <div className="p-10 text-center text-sm italic text-muted-foreground/80">
                    No teams found.
                  </div>
                ) : (
                  filteredAvailable.map((team) => {
                    const trend = team.trend ?? "stable";
                    const trendClasses =
                      trend === "up"
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : trend === "down"
                        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                        : "border-border bg-white/5 text-muted-foreground";

                    return (
                      <div
                        key={team.id}
                        onClick={() => {
                          if (!canPickReplacement) return;
                          setSelectedPickup(team);
                          resetConfirmState();
                        }}
                        className={[
                          "grid cursor-pointer grid-cols-1 gap-2 border-b border-border px-4 py-3 transition-colors last:border-b-0 md:grid-cols-[minmax(0,1.6fr)_110px_80px_110px] md:gap-3",
                          !canPickReplacement ? "cursor-not-allowed opacity-60" : "",
                          selectedPickup?.id === team.id ? "bg-emerald-500/15" : "hover:bg-white/5",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{team.name}</p>
                          <p className="text-xs text-muted-foreground">{team.id}</p>
                        </div>
                        <div className="flex items-center justify-between md:justify-start">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground md:hidden">
                            Trend
                          </span>
                          <span
                            className={[
                              "inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                              trendClasses,
                            ].join(" ")}
                          >
                            {trend}
                          </span>
                        </div>
                        <div className="flex items-center justify-between md:justify-end font-mono text-sm text-foreground/90">
                          <span className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground md:hidden">
                            Points
                          </span>
                          <span>{team.points ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-end pt-1 md:pt-0">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!canPickReplacement) return;
                              setSelectedPickup(team);
                              resetConfirmState();
                            }}
                            disabled={!canPickReplacement}
                            className={[
                              "rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                              selectedPickup?.id === team.id
                                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                                : "border-border bg-white/5 text-muted-foreground hover:text-foreground",
                              !canPickReplacement ? "cursor-not-allowed opacity-60" : "",
                            ].join(" ")}
                          >
                            {selectedPickup?.id === team.id ? "Selected" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="h-fit xl:sticky xl:top-24">
          <div className="space-y-5 rounded-2xl border border-border bg-card/80 p-5 shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
            <h3 className="text-lg font-bold text-foreground">Transfer Summary</h3>

            {selectedDrop && selectedPickup ? (
              <div className="rounded-xl border border-border bg-black/15 p-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-xs font-bold text-foreground/80">
                      {selectedDrop.id.slice(0, 3).toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{selectedDrop.name}</p>
                    <span className="mt-1 inline-flex rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                      OUT
                    </span>
                  </div>
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-xs font-bold text-foreground/80">
                      {selectedPickup.id.slice(0, 3).toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{selectedPickup.name}</p>
                    <span className="mt-1 inline-flex rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      IN
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-black/15 p-6 text-center">
                <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground/70" />
                <p className="text-sm text-muted-foreground">
                  Select a release team and replacement to preview your transfer.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-black/15 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Current Score</span>
                  <span className="font-mono text-foreground">{userScore}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Transfer Cost</span>
                  <span className="font-mono text-orange-300">-{transferCost}</span>
                </div>
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="font-semibold text-foreground">Projected Score</span>
                  <span className="font-mono text-xl font-bold text-foreground">{projectedScore}</span>
                </div>
              </div>
            </div>

            <div
              className={[
                "flex items-start gap-2 rounded-lg border p-3 text-xs",
                !transferWindowOpen
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : transfersRemaining <= 0
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : transfersRemaining === 1
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                  : "border-border bg-white/5 text-muted-foreground",
              ].join(" ")}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {!transferWindowOpen
                  ? "Transfers are currently closed."
                  : transfersRemaining <= 0
                  ? "No transfers remaining."
                  : transfersRemaining === 1
                  ? "This is your final transfer. Points will be deducted immediately."
                  : "Transfer cost is deducted immediately after confirmation."}
              </p>
            </div>

            {isConfirmed ? (
              <div className="w-full rounded-xl bg-emerald-500 py-4 text-center font-bold text-white shadow-lg shadow-emerald-500/20">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 size={18} /> Trade Confirmed
                </span>
              </div>
            ) : (
              <button
                disabled={tradeButtonDisabled}
                onMouseDown={startConfirm}
                onMouseUp={stopConfirm}
                onMouseLeave={stopConfirm}
                onTouchStart={startConfirm}
                onTouchEnd={stopConfirm}
                className={[
                  "relative w-full overflow-hidden rounded-xl border py-4 text-sm font-bold uppercase tracking-wide transition-all select-none",
                  tradeButtonDisabled
                    ? "cursor-not-allowed border-border bg-white/5 text-muted-foreground/70"
                    : "cursor-pointer border-emerald-300/50 bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400",
                ].join(" ")}
              >
                <span
                  className="absolute left-0 top-0 bottom-0 bg-white/25 transition-all duration-75 ease-linear"
                  style={{ width: `${confirmProgress}%` }}
                />
                <span className="relative z-10">
                  {isSubmitting || transferBusy
                    ? "Executing..."
                    : confirmProgress > 0
                    ? "Hold to Confirm..."
                    : !transferWindowOpen
                    ? "Window Closed"
                    : transfersRemaining <= 0
                    ? "No Transfers Left"
                    : !selectedDrop || !selectedPickup
                    ? "Select Teams"
                    : "Hold to Trade"}
                </span>
              </button>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              Long press the button to execute transfer
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};


export default DashboardTransferMarket;
