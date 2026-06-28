"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, History, Lock, Search, Unlock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MarketTeam = {
  id: string;
  name: string;
  status?: "active" | "eliminated" | "available";
  trend?: "up" | "down" | "stable";
  points?: number;
  flagUrl?: string;
  tier?: number;
};

// Mirrors the server-side calculateTransferCost in functions/src/transfers.ts
const BASE_COST = 3;
const UPGRADE_MULTIPLIER = 4;  // per tier step when upgrading
const FLAT_DOWNGRADE_COST = 2; // flat cost for any downgrade
const MINIMUM_COST = 2;

function calculateTransferCost(dropTier: number, pickupTier: number): number {
  const tierDifference = pickupTier - dropTier;
  if (tierDifference > 0) return FLAT_DOWNGRADE_COST; // downgrade — flat
  if (tierDifference < 0) {
    return Math.max(MINIMUM_COST, BASE_COST + Math.abs(tierDifference) * UPGRADE_MULTIPLIER);
  }
  return Math.max(MINIMUM_COST, BASE_COST); // lateral
}

function costBreakdown(dropTier: number, pickupTier: number): string[] {
  const tierDifference = pickupTier - dropTier;
  if (tierDifference > 0) return [`Downgrade — flat fee: ${FLAT_DOWNGRADE_COST} pts`];
  if (tierDifference === 0) return [`Same tier — base fee: ${BASE_COST} pts`];
  const steps = Math.abs(tierDifference);
  const upgradeCost = steps * UPGRADE_MULTIPLIER;
  return [
    `Base fee: ${BASE_COST} pts`,
    `Tier upgrade ×${steps}: +${upgradeCost} pts`,
    `Total: ${BASE_COST + upgradeCost} pts`,
  ];
}

export type TradeResult = {
  ok: boolean;
  message?: string;
};

/** Small inline flag for the replacement list and status bar */
function FlagInline({ team, size = 22 }: { team: MarketTeam; size?: number }) {
  const code = team.id.slice(0, 3).toUpperCase();
  const cls = `h-[${size}px] w-[${size}px]`;
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-sm border border-[var(--ff-hairline)] object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className={cn("flex shrink-0 items-center justify-center rounded-sm border border-[var(--ff-hairline)] bg-black/25 font-ff-ui text-[9px] font-bold text-[var(--ff-fg-faint)]", cls)}
    >
      {code}
    </span>
  );
}

/** Full flag-background card — matches My Teams SquadCard aesthetic */
function SquadReleaseCard({
  team,
  selected,
  onClick,
}: {
  team: MarketTeam;
  selected: boolean;
  onClick: () => void;
}) {
  const scoreFmtLocal = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "0";
  const isEliminated = team.status === "eliminated";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border text-left transition-all duration-200",
        "aspect-[3/2] shadow-[0_8px_20px_rgba(0,0,0,0.28)]",
        selected
          ? "scale-[0.96] border-[rgba(239,68,68,0.6)] ring-1 ring-[rgba(239,68,68,0.35)]"
          : isEliminated
          ? "border-[rgba(239,68,68,0.5)]"
          : "border-white/10 hover:border-white/25"
      )}
    >
      {/* Flag background */}
      {team.flagUrl ? (
        <img
          src={team.flagUrl}
          alt={team.name}
          className="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
          <span className="text-xl font-black text-white/10 tracking-tight">{team.id.slice(0, 3).toUpperCase()}</span>
        </div>
      )}
      {/* Gradient overlay — matches MyTeams */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent",
        selected && "from-[#1a0505]/95 via-[#1a0505]/55",
        isEliminated && !selected && "from-[#1a0505]/98 via-[#1a0505]/60"
      )} />

      {/* Eliminated — diagonal stamp overlay (matches MyTeams SquadCard) */}
      {isEliminated && !selected && (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-red-950/30" />
          <span
            className="relative select-none font-ff-display font-black uppercase tracking-[0.18em] text-red-500/70 mix-blend-screen"
            style={{
              fontSize: "clamp(11px, 4.5cqw, 18px)",
              transform: "rotate(-32deg)",
              textShadow: "0 0 24px rgba(239,68,68,0.5)",
              letterSpacing: "0.2em",
              whiteSpace: "nowrap",
              border: "1.5px solid rgba(239,68,68,0.35)",
              padding: "3px 10px",
              borderRadius: "3px",
            }}
          >
            Eliminated
          </span>
        </div>
      )}

      {/* Content */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-2.5 pb-2 pt-5">
        <div className="flex items-end justify-between gap-1">
          <p className={cn(
            "min-w-0 truncate font-black leading-tight text-[13px]",
            selected ? "text-[#ef4444]" : "text-white"
          )}>
            {team.name}
          </p>
          <div className="shrink-0 text-right">
            <div className="text-[7px] uppercase tracking-wider text-white/50 font-semibold leading-none mb-0.5">pts</div>
            <div className={cn(
              "font-ff-display font-black leading-none tabular-nums text-[22px]",
              selected ? "text-[#ef4444]" : isEliminated ? "text-[var(--ff-danger)]" : "text-white"
            )}>
              {scoreFmtLocal(team.points ?? 0)}
            </div>
          </div>
        </div>
      </div>
      {/* Selected indicator */}
      {selected && (
        <div className="absolute top-2 right-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-[#ef4444]">
          <span className="font-ff-ui text-[10px] font-bold text-white">✕</span>
        </div>
      )}
    </button>
  );
}

/** Small flag for the cost modal */
function FlagModal({ team }: { team: MarketTeam }) {
  if (team.flagUrl) {
    return (
      <img src={team.flagUrl} alt="" className="h-8 w-8 shrink-0 rounded-md border border-[var(--ff-hairline)] object-cover" />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--ff-hairline)] bg-black/25 font-ff-ui text-[10px] font-bold text-[var(--ff-fg-faint)]">
      {team.id.slice(0, 3).toUpperCase()}
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
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [costModalOpen, setCostModalOpen] = useState(false);

  // Tiered cost
  const dropTier = selectedDrop?.tier ?? 0;
  const pickupTier = selectedPickup?.tier ?? 0;
  const tieredCost =
    selectedDrop && selectedPickup
      ? calculateTransferCost(dropTier, pickupTier)
      : 0;

  const projectedScore = selectedDrop && selectedPickup ? userScore - tieredCost : userScore;

  const canExecuteTrade =
    Boolean(selectedDrop && selectedPickup) &&
    transferWindowOpen &&
    transfersRemaining > 0 &&
    !transferBusy &&
    !isSubmitting;

  const canPickReplacement = Boolean(selectedDrop);

  // Auto-open cost modal as soon as both teams are chosen
  const prevPickupId = useRef<string | null>(null);
  useEffect(() => {
    if (
      selectedDrop &&
      selectedPickup &&
      selectedPickup.id !== prevPickupId.current
    ) {
      prevPickupId.current = selectedPickup.id;
      if (canExecuteTrade) setCostModalOpen(true);
    }
    if (!selectedPickup) {
      prevPickupId.current = null;
    }
  }, [selectedDrop, selectedPickup, canExecuteTrade]);

  const executeTrade = async (trade: { drop: MarketTeam; pickup: MarketTeam }) => {
    setIsSubmitting(true);
    try {
      const result = await onTrade(trade);
      if (result?.ok) {
        setIsConfirmed(true);
        return;
      }
    } catch {
      // error shown via transferError prop
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalConfirm = async () => {
    if (!selectedDrop || !selectedPickup || !canExecuteTrade) return;
    setCostModalOpen(false);
    await executeTrade({ drop: selectedDrop, pickup: selectedPickup });
  };

  const handleModalBack = () => {
    setCostModalOpen(false);
    setSelectedPickup(null);
    prevPickupId.current = null;
  };

  const scoreFmt = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(n);

  const acknowledgeSuccess = () => {
    setIsConfirmed(false);
    setSelectedDrop(null);
    setSelectedPickup(null);
    setSearch("");
    prevPickupId.current = null;
  };

  const filteredAvailable = availableTeams.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase())
  );

  // Slim status bar shown at bottom when a team is selected
  const statusBar = (
    <div className="rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[#0f1115] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 font-ff-ui text-[13px]">
          {selectedDrop ? (
            <>
              <FlagInline team={selectedDrop} />
              <span className="truncate font-semibold text-[#ef4444]">{selectedDrop.name}</span>
              <span className="text-[var(--ff-fg-muted)]">→</span>
              {selectedPickup ? (
                <>
                  <FlagInline team={selectedPickup} />
                  <span className="truncate font-semibold text-[var(--ff-accent-text)]">
                    {selectedPickup.name}
                  </span>
                </>
              ) : (
                <span className="text-[var(--ff-fg-faint)]">Pick replacement…</span>
              )}
            </>
          ) : (
            <span className="text-[var(--ff-fg-quieter)]">
              {!transferWindowOpen
                ? "Transfers are closed."
                : transfersRemaining <= 0
                  ? "No transfers remaining."
                  : "Release a team on the left."}
            </span>
          )}
        </div>

        {/* Re-open modal if dismissed */}
        {selectedDrop && selectedPickup && canExecuteTrade && !costModalOpen ? (
          <button
            type="button"
            onClick={() => setCostModalOpen(true)}
            className="shrink-0 rounded-[8px] border border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] px-3 py-1.5 font-ff-ui text-[11px] font-semibold text-[var(--ff-accent-text)]"
          >
            Review
          </button>
        ) : null}

        {!transferWindowOpen || transfersRemaining <= 0 ? (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-ff-ui text-[10px]",
              !transferWindowOpen
                ? "border-[var(--ff-danger)]/30 bg-[rgba(239,68,68,0.08)] text-[var(--ff-danger)]"
                : "border-[var(--ff-gold)]/30 bg-[rgba(245,158,11,0.08)] text-[var(--ff-gold)]"
            )}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            <span>{!transferWindowOpen ? "Closed" : "None left"}</span>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "relative min-h-0 pb-6 font-ff-ui text-[var(--ff-fg-primary)] lg:flex lg:min-h-0 lg:flex-col",
        selectedDrop && !isConfirmed && "pb-32"
      )}
    >
      {/* Cost confirmation modal */}
      {costModalOpen && selectedDrop && selectedPickup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) handleModalBack(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />

          {/* Sheet */}
          <div className="relative z-10 mx-4 w-full max-w-sm rounded-[20px] border border-[rgba(255,255,255,0.08)] bg-[#0f1218] p-6 animate-in zoom-in-95 duration-200">
            {/* Teams swap */}
            <div className="mb-6 flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <FlagModal team={selectedDrop} />
                <span className="max-w-[90px] text-center font-ff-ui text-[13px] font-semibold leading-tight text-[#ef4444]">
                  {selectedDrop.name}
                </span>
              </div>
              <span className="font-ff-ui text-[18px] text-[var(--ff-fg-faint)]">→</span>
              <div className="flex flex-col items-center gap-2">
                <FlagModal team={selectedPickup} />
                <span className="max-w-[90px] text-center font-ff-ui text-[13px] font-semibold leading-tight text-[var(--ff-accent-text)]">
                  {selectedPickup.name}
                </span>
              </div>
            </div>

            {/* Cost */}
            <div className="mb-6 text-center">
              <p className="font-ff-display text-[48px] font-extrabold leading-none tracking-tight text-[#ef4444]">
                −{tieredCost}
              </p>
              <p className="mt-1 font-ff-ui text-[12px] text-[var(--ff-fg-quieter)]">pts · fee</p>
              {/* Cost breakdown */}
              <div className="mt-3 mx-auto inline-flex flex-col gap-0.5 rounded-lg bg-white/[0.04] px-3 py-2 text-left">
                {costBreakdown(dropTier, pickupTier).map((line) => (
                  <p key={line} className="font-ff-ui text-[11px] text-[var(--ff-fg-quieter)]">{line}</p>
                ))}
              </div>
              <p className="mt-3 font-ff-ui text-[13px] text-[var(--ff-fg-muted)]">
                Score after:{" "}
                <span className="font-semibold text-[var(--ff-fg-primary)]">
                  {scoreFmt(projectedScore)} pts
                </span>
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleModalBack}
                className="flex-1 rounded-[10px] border border-[var(--ff-hairline)] bg-transparent py-3 font-ff-ui text-[12px] font-semibold text-[var(--ff-fg-muted)] transition-colors hover:border-[var(--ff-hairline-strong)] hover:text-[var(--ff-fg-secondary)]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isSubmitting || transferBusy}
                onClick={handleModalConfirm}
                className={cn(
                  "flex-1 rounded-[10px] border py-3 font-ff-ui text-[12px] font-semibold transition-colors",
                  isSubmitting || transferBusy
                    ? "cursor-wait border-[var(--ff-hairline)] text-[var(--ff-fg-quieter)]"
                    : "border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] text-[var(--ff-accent-text)] hover:bg-[var(--ff-accent-dim)]"
                )}
              >
                {isSubmitting || transferBusy ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

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
          {/* ── Transfer status header ── */}
          <div className="mb-5 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0f1115] px-4 py-3.5">
            {/* Row 1: icon + title */}
            <div className="flex items-center gap-3">
              {transferWindowOpen
                ? <Unlock className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                : <Lock className="h-5 w-5 shrink-0 text-[var(--ff-danger)]" aria-hidden />
              }
              <p className={cn(
                "font-ff-display text-[18px] font-bold leading-tight",
                transferWindowOpen ? "text-emerald-400" : "text-[var(--ff-fg-primary)]"
              )}>
                {transferWindowOpen ? "Window Open" : "Window Closed"}
              </p>
            </div>
            {/* Row 2: chips — always on their own line so they never overlap the title */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className={cn(
                "rounded-full border px-3 py-1 font-ff-ui text-[11px] font-semibold",
                transfersRemaining > 0
                  ? "border-[var(--ff-gold)]/40 bg-[rgba(245,158,11,0.1)] text-[var(--ff-gold)]"
                  : "border-[var(--ff-hairline)] bg-white/[0.03] text-[var(--ff-fg-quieter)]"
              )}>
                {transfersRemaining} transfer{transfersRemaining === 1 ? "" : "s"} remaining
              </span>
              <span className="rounded-full border border-[var(--ff-hairline)] bg-white/[0.03] px-3 py-1 font-ff-ui text-[11px] font-semibold text-[var(--ff-fg-secondary)]">
                {scoreFmt(userScore)} pts
              </span>
              <Link
                href="/transfer-history"
                className="flex items-center gap-1 rounded-full border border-[var(--ff-hairline)] bg-white/[0.03] px-3 py-1 font-ff-ui text-[11px] text-[var(--ff-fg-quieter)] transition-colors hover:text-[var(--ff-accent-text)]"
              >
                <History className="h-3 w-3" aria-hidden />
                History
              </Link>
              {transferWindowLabel ? (
                <span className="font-ff-ui text-[11px] text-[var(--ff-fg-faint)]">{transferWindowLabel}</span>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col md:min-h-0 md:flex-1">
            <div className="mb-6 flex min-h-0 max-h-none flex-col gap-6 md:mb-0 md:max-h-[min(640px,calc(100dvh-15rem))] md:flex-1 md:flex-row md:items-stretch md:gap-6 md:overflow-hidden">
              <div className="md:flex md:min-h-0 md:w-[42%] md:max-w-xs md:shrink-0 md:flex-col">
                <p className="mb-2.5 font-ff-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">
                  Release a team
                </p>
                {releaseTeams.length === 0 ? (
                  <div className="rounded-xl border border-[var(--ff-hairline)] bg-[var(--ff-bg-card-alt)] p-8 text-center font-ff-ui text-sm text-[var(--ff-fg-quiet)]">
                    No squad teams available.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-2 md:max-h-full md:auto-rows-min md:overflow-y-auto">
                    {releaseTeams.map((team) => (
                      <SquadReleaseCard
                        key={team.id}
                        team={team}
                        selected={selectedDrop?.id === team.id}
                        onClick={() => {
                          setSelectedDrop(team);
                          setSelectedPickup(null);
                          prevPickupId.current = null;
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <section
                className={cn(
                  "flex min-h-0 flex-col transition-opacity duration-200 motion-reduce:transition-none md:min-h-0 md:flex-1",
                  canPickReplacement ? "opacity-100" : "pointer-events-none opacity-[0.35]"
                )}
                aria-disabled={!canPickReplacement}
              >
                <p className="mb-2 font-ff-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">
                  Choose replacement
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

                <div className="max-h-[min(50vh,420px)] min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card)] md:max-h-none">
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
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-2.5 border-b border-[var(--ff-hairline-muted)] px-3 py-2.5 text-left transition-colors last:border-b-0",
                            !canPickReplacement && "cursor-not-allowed",
                            selected
                              ? "rounded-r-lg border-l-[3px] border-l-[var(--ff-accent-text)] bg-[var(--ff-accent-dim)] pl-[9px]"
                              : "border-l-[3px] border-l-transparent hover:bg-white/[0.03]"
                          )}
                        >
                          <FlagInline team={team} />
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

      {!isConfirmed && selectedDrop ? (
        <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom,0px))] z-40 border-t border-[var(--ff-hairline)] bg-[var(--ff-bg-blur)] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[20px]">
          <div className="mx-auto max-w-2xl">{statusBar}</div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardTransferMarket;
