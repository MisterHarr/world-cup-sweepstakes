"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Search, Shield, Zap } from "lucide-react";

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
  const [pendingTrade, setPendingTrade] = useState<{
    drop: MarketTeam;
    pickup: MarketTeam;
  } | null>(null);

  const projectedScore = selectedDrop && selectedPickup ? userScore - penalty : userScore;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearConfirmInterval = () => {
    if (intervalRef.current === null) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };
  const resetConfirmState = () => {
    clearConfirmInterval();
    setPendingTrade(null);
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

  const startConfirm = () => {
    if (!selectedDrop || !selectedPickup || !canExecuteTrade || isConfirmed) return;

    setPendingTrade({
      drop: selectedDrop,
      pickup: selectedPickup,
    });

    clearConfirmInterval();
    intervalRef.current = setInterval(() => {
      setConfirmProgress((prev) => {
        const next = Math.min(prev + 4, 100);
        if (next >= 100) {
          clearConfirmInterval();
        }
        return next;
      });
    }, 20);
  };

  const stopConfirm = () => {
    if (isConfirmed || isSubmitting) return;
    clearConfirmInterval();
    setPendingTrade(null);
    setConfirmProgress(0);
  };

  useEffect(() => {
    if (confirmProgress < 100) return;
    if (isSubmitting || isConfirmed) return;
    if (!pendingTrade) return;

    const trade = pendingTrade;
    let cancelled = false;

    setPendingTrade(null);
    setIsSubmitting(true);

    void onTrade(trade)
      .then((result) => {
        if (cancelled) return;
        if (result?.ok) {
          setIsConfirmed(true);
          return;
        }
        setIsConfirmed(false);
        setConfirmProgress(0);
      })
      .catch(() => {
        if (cancelled) return;
        setIsConfirmed(false);
        setConfirmProgress(0);
      })
      .finally(() => {
        if (cancelled) return;
        setIsSubmitting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [confirmProgress, isSubmitting, isConfirmed, pendingTrade, onTrade]);

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
    <div className="h-full flex flex-col pb-24 md:pb-0 relative space-y-6">
      <div
        className={[
          "border rounded-xl p-4",
          transferWindowOpen
            ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
            : "bg-destructive/10 border-destructive/30",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className={`w-5 h-5 ${transferWindowOpen ? "text-amber-500" : "text-destructive"}`} />
            <div>
              <p className="font-medium text-foreground">
                {transferWindowOpen ? "Transfer Window Active" : "Transfer Window Closed"}
              </p>
              <p className="text-sm text-muted-foreground">{transferWindowLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {transfersRemaining} transfer{transfersRemaining === 1 ? "" : "s"} remaining
              </p>
              <Link
                href="/transfer-history"
                className="inline-block mt-1 text-xs text-primary hover:text-primary/80 underline underline-offset-2"
              >
                View transfer history
              </Link>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{userScore}</p>
            <p className="text-xs text-muted-foreground">Current Points</p>
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

      <div className="grid md:grid-cols-2 gap-6 flex-1">
        <div className="bg-card/70 border border-border rounded-2xl overflow-hidden flex flex-col shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
          <div className="p-5 border-b border-border bg-white/5 flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Shield size={18} className="text-muted-foreground/70" aria-hidden="true" /> My Squad
            </h3>
            <span className="text-xs text-muted-foreground/70 font-bold uppercase tracking-wider">
              Select to Release
            </span>
          </div>
          <div className="p-3 space-y-3 overflow-y-auto max-h-[450px]">
            {releaseTeams.length === 0 ? (
              <div className="text-center p-10 text-muted-foreground/70 italic">
                No squad teams available.
              </div>
            ) : (
              releaseTeams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    setSelectedDrop(team);
                    resetConfirmState();
                  }}
                  className={[
                    "p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all duration-200",
                    selectedDrop?.id === team.id
                      ? "bg-rose-500/15 border-rose-500/30 shadow-md ring-1 ring-rose-500/20 transform scale-[1.02]"
                      : "bg-card/70 border-border hover:border-border hover:shadow-sm",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-bold text-foreground">{team.name}</div>
                    <div className="text-xs text-muted-foreground/80 mt-1 font-medium">
                      Status:{" "}
                      <span
                        className={
                          team.status === "eliminated" ? "text-destructive" : "text-foreground/90"
                        }
                      >
                        {team.status ?? "active"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-muted-foreground font-medium">
                      {team.points ?? 0} pts
                    </div>
                    {selectedDrop?.id === team.id && (
                      <div className="text-[10px] text-rose-300 font-bold uppercase mt-1">
                        Releasing
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card/70 border border-border rounded-2xl overflow-hidden flex flex-col shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
          <div className="p-5 border-b border-border bg-white/5 flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Search size={18} className="text-muted-foreground/70" /> Market
            </h3>
            <span className="text-xs text-muted-foreground/70 font-bold uppercase tracking-wider">
              Select to Buy
            </span>
          </div>
          <div className="p-3">
            <Input
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
          </div>
          <div className="px-3 pb-3 space-y-3 overflow-y-auto max-h-[400px]">
            {filteredAvailable.length === 0 ? (
              <div className="text-center p-10 text-muted-foreground/70 italic">
                No teams found.
              </div>
            ) : (
              filteredAvailable.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    setSelectedPickup(team);
                    resetConfirmState();
                  }}
                  className={[
                    "p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all duration-200",
                    selectedPickup?.id === team.id
                      ? "bg-emerald-500/15 border-emerald-500/30 shadow-md ring-1 ring-emerald-500/20 transform scale-[1.02]"
                      : "bg-card/70 border-border hover:border-border hover:shadow-sm",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-bold text-foreground">{team.name}</div>
                    <div className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1 font-medium">
                      Trend:{" "}
                      <span className="text-foreground/90">{team.trend || "stable"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-muted-foreground/80">
                      {team.points ?? 0} pts
                    </div>
                    {selectedPickup?.id === team.id && (
                      <div className="text-[10px] text-emerald-300 font-bold uppercase mt-1">
                        Buying
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:relative md:mt-8 bg-card/90 backdrop-blur-xl border-t md:border border-border/60 md:rounded-2xl p-6 shadow-[0_-12px_48px_rgba(0,0,0,0.12)] z-30">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center justify-between w-full md:w-auto gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest mb-1">
                Current Score
              </div>
              <div className="font-mono text-xl text-foreground/90 font-medium">{userScore}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-px w-8 bg-white/10 mb-1"></div>
              <div className="text-xs text-orange-300 font-bold">-{transferCost} pts</div>
              <div className="h-px w-8 bg-white/10 mt-1"></div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest mb-1">
                Projected Score
              </div>
              <div
                className={`font-mono text-2xl font-bold ${
                  projectedScore < 0 ? "text-orange-300" : "text-foreground"
                }`}
              >
                {projectedScore}
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto">
            {isConfirmed ? (
              <div className="w-full md:w-64 bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={20} /> Trade Confirmed
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
                  "relative w-full md:w-64 py-4 rounded-xl border font-bold text-sm uppercase tracking-wider overflow-hidden transition-all select-none",
                  tradeButtonDisabled
                    ? "bg-white/5 text-muted-foreground/70 cursor-not-allowed border-border"
                    : "bg-emerald-500 text-slate-950 cursor-pointer border-emerald-300/50 hover:bg-emerald-400 shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:scale-[1.02]",
                ].join(" ")}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 bg-white/25 transition-all duration-75 ease-linear"
                  style={{ width: `${confirmProgress}%` }}
                />
                <div className="relative z-10 flex items-center justify-center gap-2 text-inherit">
                  {isSubmitting || transferBusy
                    ? "Executing..."
                    : confirmProgress > 0
                    ? "Hold to Confirm..."
                    : !transferWindowOpen
                    ? "Window Closed"
                    : transfersRemaining <= 0
                    ? "No Transfers Left"
                    : "Hold to Trade"}
                </div>
              </button>
            )}
            <div className="text-center mt-3 text-[10px] text-muted-foreground/70 font-medium hidden md:block">
              Long press button to execute trade
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default DashboardTransferMarket;
