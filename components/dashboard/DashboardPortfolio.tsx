"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock, Crown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatMatchDate,
  type MatchResult,
  type NextMatch,
} from "@/lib/teamMatchData";

type DashboardTeam = {
  id: string;
  name: string;
  group: string;
  tier: number;
  flagUrl: string;
  isEliminated?: boolean;
};

type TeamRecord = {
  name?: string;
  wins?: number;
  goalsScored?: number;
  cleanSheets?: number;
  draws?: number;
  redCards?: number;
  yellowCards?: number;
  [key: string]: unknown;
};

type TeamMatchState = {
  recentForm: MatchResult[];
  nextMatch: NextMatch | null;
  loading: boolean;
};

type DashboardPortfolioProps = {
  userId?: string | null;
  userStats: {
    score: number;
    rank: number | null;
  };
  leaderboardCount: number;
  teamStats: {
    active: number;
    eliminated: number;
    transfers: number;
  };
  featuredDisplay: DashboardTeam | null;
  drawnDisplay: DashboardTeam[];
  expandedTeam: string | null;
  teamMatchData: Record<string, TeamMatchState>;
  teamsById: Record<string, TeamRecord>;
  allTeamNames?: Record<string, string>;
  onTeamExpand: (teamKey: string, teamId: string) => void;
  calculateTeamPoints: (team: Record<string, unknown> | null | undefined) => number;
};

function asNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

// Render a score with the same natural precision the rest of the app uses
// (the leaderboard, scoring engine, etc): up to 2 decimal places, with
// trailing zeros trimmed. Forcing 1 dp here rounded −0.25 (one yellow) to
// −0.3 and 5.75 to 5.8 — visibly inconsistent with the leaderboard total.
function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(2)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}


function FormChip({ value }: { value: MatchResult }) {
  const className =
    value === "W"
      ? "border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] text-[var(--ff-accent-text)]"
      : value === "D"
        ? "border-[var(--ff-hairline-strong)] bg-[var(--ff-bg-card-alt)] text-[var(--ff-fg-secondary)]"
        : "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] text-[var(--ff-danger)]";
  return (
    <div className={cn("flex size-7 items-center justify-center rounded-md border font-ff-ui text-xs font-bold", className)}>
      {value}
    </div>
  );
}

function TierChip({ tier }: { tier: number }) {
  const label = tier === 1 ? "Elite" : tier === 2 ? "Strong" : tier === 3 ? "Competitive" : "Underdog";
  const colors =
    tier === 1 ? "bg-amber-400/25 text-amber-200 border-amber-400/50"
    : tier === 2 ? "bg-slate-300/20 text-slate-200 border-slate-300/50"
    : tier === 3 ? "bg-orange-500/20 text-orange-200 border-orange-400/50"
    : "bg-zinc-500/20 text-zinc-300 border-zinc-400/40";
  return (
    <span className={cn("rounded border px-1.5 py-px text-[8px] font-bold leading-tight whitespace-nowrap", colors)}>
      T{tier} · {label}
    </span>
  );
}

// ─── Compact flag-background card tile ──────────────────────────────────────

function SquadCard({
  team,
  isFeatured,
  isModalOpen,
  points,
  onExpand,
  cardClass,
  objectContain = false,
}: {
  team: DashboardTeam;
  isFeatured: boolean;
  isModalOpen: boolean;
  points: number;
  onExpand: () => void;
  cardClass?: string;
  objectContain?: boolean;
}) {
  const isEliminated = team.isEliminated === true;
  const isPlaceholder = team.id.startsWith("PO_");

  if (isPlaceholder) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]",
        cardClass ?? "aspect-[3/2]",
      )}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-[10px] font-semibold text-[var(--ff-fg-quieter)]">Unavailable</span>
          <span className="text-[9px] text-[var(--ff-fg-faint)]">{team.id}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        "group relative w-full overflow-hidden text-left ff-squad-stagger",
        cardClass ?? (isFeatured ? "aspect-[4/1] rounded-2xl" : "aspect-[3/2] rounded-xl"),
        "border shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition-all duration-200",
        isModalOpen
          ? "ring-2 ring-[var(--ff-accent-border)] border-[var(--ff-accent-border)]"
          : isEliminated
            ? "border-[rgba(239,68,68,0.5)]"
            : isFeatured
              ? "border-[rgba(245,158,11,0.35)] ring-1 ring-orange-400/20"
              : "border-white/10 hover:border-white/20",
      )}
    >
      {/* Flag */}
      {team.flagUrl ? (
        <img
          src={team.flagUrl}
          alt={team.name}
          className={cn(
            "absolute inset-0 h-full w-full opacity-55 transition-transform duration-300 group-hover:scale-[1.03]",
            objectContain ? "object-contain" : "object-cover"
          )}
        />
      ) : (
        <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
          <span className="text-2xl font-black text-white/10 tracking-tight">{team.id.slice(0, 3).toUpperCase()}</span>
        </div>
      )}

      {/* Gradient — always bottom-up so content sits cleanly at bottom */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent",
        isEliminated && "from-[#1a0505]/98 via-[#1a0505]/60"
      )} />

      {/* Eliminated — diagonal stamp overlay */}
      {isEliminated && (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden" aria-hidden>
          {/* Red tint wash */}
          <div className="absolute inset-0 bg-red-950/30" />
          {/* Diagonal stamp text */}
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

      {/* Bottom content: name + tier left, pts right, chevron centred at very bottom */}
      <div className="absolute bottom-0 inset-x-0 z-10 px-3 pb-2 pt-6">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-black leading-tight text-white truncate", isFeatured ? "text-[17px]" : "text-[15px]")}>
              {team.name}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[8px] uppercase tracking-wider text-white/60 font-semibold leading-none mb-0.5">pts</div>
            <div className={cn(
              "font-ff-display font-black leading-none tabular-nums tracking-tight",
              isFeatured ? "text-[36px]" : "text-[28px]",
              isEliminated ? "text-[var(--ff-danger)]" : "text-white",
            )}>
              {formatScore(points)}
            </div>
          </div>
        </div>
        {/* Expand hint — centred chevron, no clash with score */}
        <div className="mt-1 flex justify-center">
          <ChevronDown className={cn(
            "size-3.5 text-white/40 transition-transform duration-200",
            isModalOpen && "rotate-180 text-[var(--ff-accent-text)]"
          )} />
        </div>
      </div>
    </button>
  );
}

// ─── Team detail modal ────────────────────────────────────────────────────────

function TeamDetailModal({
  team,
  points,
  isFeatured,
  teamMatchData,
  teamsById,
  allTeamNames = {},
  onClose,
}: {
  team: DashboardTeam;
  points: number;
  isFeatured: boolean;
  teamMatchData: Record<string, TeamMatchState>;
  teamsById: Record<string, TeamRecord>;
  allTeamNames?: Record<string, string>;
  onClose: () => void;
}) {
  const [activeStat, setActiveStat] = useState<string | null>(null);
  const teamState = teamMatchData[team.id];
  const nextMatch = teamState?.nextMatch ?? null;
  const opponentName = nextMatch
    ? ((teamsById[nextMatch.opponentId]?.name as string | undefined)
        ?? allTeamNames[nextMatch.opponentId]
        ?? (nextMatch.opponentId?.startsWith("TBD-") ? "To be confirmed" : nextMatch.opponentId))
    : null;
  const record = teamsById[team.id];
  const isEliminated = team.isEliminated === true;

  // Scoring formula breakdown — mirrors functions/src/scoring.ts
  const rawBreakdowns = [
    { key: "wins",        label: "Wins",         value: asNumber(record?.wins),         rate: 3,    rateLabel: "3 pts/win",     color: "text-[var(--ff-accent-text)]" },
    { key: "goals",       label: "Goals",        value: asNumber(record?.goalsScored),  rate: 1.5,  rateLabel: "1.5 pts/goal",  color: "text-[var(--ff-accent-text)]" },
    { key: "cleanSheets", label: "Clean sheets", value: asNumber(record?.cleanSheets),  rate: 1,    rateLabel: "1 pt/sheet",    color: "text-[var(--ff-accent-text)]" },
    { key: "draws",       label: "Draws",        value: asNumber(record?.draws),        rate: 1,    rateLabel: "1 pt/draw",     color: "text-[var(--ff-fg-secondary)]" },
    { key: "redCards",    label: "Red cards",    value: asNumber(record?.redCards),     rate: -1,   rateLabel: "−1 pt/card",    color: "text-[var(--ff-danger)]" },
    { key: "yellowCards", label: "Yellow cards", value: asNumber(record?.yellowCards),  rate: -0.25, rateLabel: "−0.25 pt/card", color: "text-[var(--ff-danger)]" },
  ];
  // Always show all stat rows including red/yellow cards
  const statBreakdowns = rawBreakdowns;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Sheet */}
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--ff-bg-card)] animate-in zoom-in-95 duration-200">

        {/* Flag hero */}
        <div className="relative h-28 overflow-hidden rounded-t-2xl">
          {team.flagUrl && (
            <img src={team.flagUrl} alt={team.name} className="absolute inset-0 h-full w-full object-cover opacity-55" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--ff-bg-card)] via-black/50 to-black/20" />

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 z-10 flex size-9 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white/80 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>

          {/* Star badge */}
          {isFeatured && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full border border-orange-300/60 bg-orange-500 px-2 py-[3px] text-[9px] font-black text-zinc-950">
              <Crown size={8} className="fill-current shrink-0" />
              Star · 2x
            </div>
          )}

          {/* Team name + tier */}
          <div className="absolute bottom-3 left-3 z-10">
            <p className="font-black text-[17px] text-white leading-tight">{team.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <TierChip tier={team.tier} />
              {isEliminated && <span className="text-[8px] font-bold text-[var(--ff-danger)] uppercase tracking-wider">Eliminated</span>}
            </div>
          </div>

          {/* Points */}
          <div className="absolute bottom-3 right-3 z-10 text-right">
            <div className="text-[8px] text-white/60 uppercase tracking-wider leading-none mb-0.5">pts</div>
            <div className={cn("font-ff-display text-[32px] font-black leading-none tabular-nums", isEliminated ? "text-[var(--ff-danger)]" : "text-white")}>
              {formatScore(points)}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-2 gap-2 p-3">
          {/* Form */}
          <div className="rounded-lg border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] p-2.5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">Form</p>
            {(!teamState || teamState.loading) ? (
              <div className="flex gap-1">{[...Array(5)].map((_, i) => <div key={i} className="size-7 animate-pulse rounded-md bg-[var(--ff-hairline-muted)]" />)}</div>
            ) : teamState?.recentForm?.length ? (
              <div className="flex gap-1">{teamState.recentForm.map((v, i) => <FormChip key={i} value={v} />)}</div>
            ) : (
              <p className="text-xs text-[var(--ff-fg-secondary)]">No matches yet</p>
            )}
          </div>

          {/* Next match */}
          <div className="rounded-lg border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] p-2.5">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">
              <Clock className="size-3 shrink-0 opacity-80" />
              Next
            </div>
            {(!teamState || teamState.loading) ? (
              <div className="space-y-1.5">
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--ff-hairline-muted)]" />
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--ff-hairline-muted)]" />
              </div>
            ) : nextMatch ? (
              <>
                <p className="text-sm font-bold text-[var(--ff-fg-primary)]">vs {opponentName}</p>
                <p className="text-[10px] text-[var(--ff-fg-secondary)]">{formatMatchDate(nextMatch.scheduledAt)}</p>
              </>
            ) : (
              <p className="text-xs text-[var(--ff-fg-secondary)]">No upcoming</p>
            )}
          </div>

          {/* Stats — tap/hover any tile to see points calculation */}
          {statBreakdowns.map((s) => {
            const contribution = s.value * s.rate * (isFeatured ? 2 : 1);
            const isActive = activeStat === s.key;
            // Formula row: "3 × +3 × 2⭐" — always one line, no extra row for featured
            const formulaStr = isFeatured
              ? `${s.value} × ${s.rate > 0 ? `+${s.rate}` : s.rate} × 2⭐`
              : `${s.value} × ${s.rate > 0 ? `+${s.rate}` : s.rate}`;
            const contribStr = contribution === 0
              ? "0"
              : `${contribution > 0 ? "+" : ""}${formatScore(contribution)}`;
            return (
              <button
                key={s.key}
                type="button"
                // Fixed height so neither state causes a layout jump
                className={cn(
                  "flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-1 transition-all duration-150 cursor-pointer",
                  isActive
                    ? "border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)]"
                    : "border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] hover:border-[var(--ff-accent-border)]/50"
                )}
                onClick={() => setActiveStat(isActive ? null : s.key)}
                onMouseEnter={() => setActiveStat(s.key)}
                onMouseLeave={() => setActiveStat(null)}
                aria-label={`${s.label}: ${s.value} — ${contribStr} pts`}
              >
                {isActive ? (
                  /* Breakdown view — always 2 rows, same height as normal */
                  <>
                    <p className="font-ff-ui text-[9px] leading-none text-[var(--ff-fg-faint)] tabular-nums">{formulaStr}</p>
                    <p className={cn(
                      "font-ff-display text-[16px] font-black tabular-nums leading-none",
                      contribution >= 0 ? "text-[var(--ff-accent-text)]" : "text-[var(--ff-danger)]"
                    )}>
                      {contribStr}<span className="text-[10px] font-semibold opacity-70"> pts</span>
                    </p>
                  </>
                ) : (
                  /* Normal view — always 2 rows */
                  <>
                    <p className={cn("font-ff-display text-lg font-bold tabular-nums leading-none", s.color)}>{s.value}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--ff-fg-faint)] leading-none">{s.label}</p>
                  </>
                )}
              </button>
            );
          })}
          {/* Hint */}
          <div className="col-span-2 -mt-1 mb-0.5 text-center">
            <p className="font-ff-ui text-[9px] text-[var(--ff-fg-faint)]">Tap any stat to see points breakdown</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function DashboardPortfolio({
  userId,
  userStats,
  leaderboardCount,
  teamStats,
  featuredDisplay,
  drawnDisplay,
  expandedTeam,
  teamMatchData,
  teamsById,
  allTeamNames = {},
  onTeamExpand,
  calculateTeamPoints,
}: DashboardPortfolioProps) {
  const previousRank = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (!userId) return null;
    if (!userStats.rank) return null;
    const key = `dashboard:rank:${userId}`;
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [userId, userStats.rank]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userId) return;
    if (!userStats.rank) return;
    window.localStorage.setItem(`dashboard:rank:${userId}`, String(userStats.rank));
  }, [userId, userStats.rank]);

  const rankTrend = useMemo(() => {
    if (!userStats.rank) return "none" as const;
    if (previousRank === null) return "new" as const;
    if (userStats.rank < previousRank) return "up" as const;
    if (userStats.rank > previousRank) return "down" as const;
    return "same" as const;
  }, [previousRank, userStats.rank]);

  const rankDelta = useMemo(() => {
    if (!userStats.rank || previousRank === null) return 0;
    return Math.abs(previousRank - userStats.rank);
  }, [previousRank, userStats.rank]);

  const rankTrendCaption = useMemo(() => {
    if (!userStats.rank) return "";
    if (rankTrend === "new") return "New this round";
    if (rankTrend === "up") return `↑ ${rankDelta || 1} this round`;
    if (rankTrend === "down") return `↓ ${rankDelta || 1} this round`;
    if (rankTrend === "same") return "No change";
    return "";
  }, [rankTrend, rankDelta, userStats.rank]);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const countUpDoneRef = useRef(false);
  const countUpRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    countUpDoneRef.current = false;
    setDisplayScore(0);
  }, [userId]);

  useEffect(() => {
    const target = Number(userStats.score);
    if (!Number.isFinite(target)) return;
    if (prefersReducedMotion) { setDisplayScore(target); countUpDoneRef.current = true; return; }
    if (countUpDoneRef.current) { setDisplayScore(target); return; }
    let countUpMs = 950;
    if (typeof window !== "undefined") {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--ff-count-up-ms").trim();
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) countUpMs = parsed;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / countUpMs);
      setDisplayScore(target * easeOutCubic(t));
      if (t < 1) { countUpRafRef.current = requestAnimationFrame(tick); }
      else { countUpRafRef.current = null; countUpDoneRef.current = true; }
    };
    countUpRafRef.current = requestAnimationFrame(tick);
    return () => { if (countUpRafRef.current != null) { cancelAnimationFrame(countUpRafRef.current); countUpRafRef.current = null; } };
  }, [userStats.score, prefersReducedMotion, userId]);

  const scoreDisplay = useMemo(() => formatScore(displayScore), [displayScore]);

  const [modalTeam, setModalTeam] = useState<{ team: DashboardTeam; isFeatured: boolean; points: number } | null>(null);

  return (
    <div className="mb-4 space-y-5 md:mb-6 md:space-y-7">

      {/* ── Score header ─────────────────────────────────────────────────────
           All sizes: score left, stats right (2 rows on mobile, cards on md+) */}
      <div className={cn("flex items-end gap-4 md:gap-6", !prefersReducedMotion && "ff-rank-chip-in")}>

        {/* Big score */}
        <p className="font-ff-display text-[2.8rem] md:text-[5rem] font-extrabold leading-none tracking-[-0.02em] text-[var(--ff-fg-primary)] shrink-0">
          {scoreDisplay}
        </p>

        {/* Mobile stats — always to the right of score in 2 compact rows */}
        <div className="flex flex-col gap-1 pb-1 md:hidden">
          {/* Row 1: rank */}
          <div className="flex items-baseline gap-1.5">
            {userStats.rank ? (
              <>
                <span className="font-ff-display text-[20px] font-extrabold leading-none text-[var(--ff-gold)] tabular-nums">#{userStats.rank}</span>
                <span className="font-ff-ui text-[9px] text-[var(--ff-fg-faint)]">of {leaderboardCount}</span>
                {rankTrendCaption ? <span className="font-ff-ui text-[9px] text-[var(--ff-fg-secondary)]">{rankTrendCaption}</span> : null}
              </>
            ) : (
              <span className="font-ff-ui text-[9px] text-[var(--ff-fg-secondary)]">Unranked</span>
            )}
          </div>
          {/* Row 2: active / elim / transfers */}
          <div className="flex items-center gap-2.5">
            <span className="font-ff-ui text-[9px] text-[var(--ff-fg-faint)]"><span className="font-ff-display text-xs font-bold mr-0.5 text-[var(--ff-accent-text)]">{teamStats.active}</span>active</span>
            <span className="font-ff-ui text-[9px] text-[var(--ff-fg-faint)]"><span className="font-ff-display text-xs font-bold mr-0.5 text-[var(--ff-danger)]">{teamStats.eliminated}</span>elim</span>
            <span className="font-ff-ui text-[9px] text-[var(--ff-fg-faint)]"><span className="font-ff-display text-xs font-bold mr-0.5 text-[var(--ff-gold)]">{teamStats.transfers}</span>transfers</span>
          </div>
        </div>

        {/* md+ stat cards */}
        <div className="hidden md:flex md:flex-1 md:items-end md:gap-3 md:pb-2">
          {/* Rank */}
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] px-4 py-3">
            <span className="font-ff-display text-[26px] font-extrabold leading-none text-[var(--ff-gold)] tabular-nums">
              {userStats.rank ? `#${userStats.rank}` : "—"}
            </span>
            <span className="mt-0.5 font-ff-ui text-[9px] text-[var(--ff-fg-faint)]">of {leaderboardCount}</span>
            {rankTrendCaption ? <span className="mt-0.5 font-ff-ui text-[9px] text-[var(--ff-fg-secondary)]">{rankTrendCaption}</span> : null}
          </div>
          {/* Active */}
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] px-4 py-3">
            <span className="font-ff-display text-[26px] font-extrabold leading-none text-[var(--ff-accent-text)]">{teamStats.active}</span>
            <span className="mt-0.5 font-ff-ui text-[9px] text-[var(--ff-fg-faint)]">active</span>
          </div>
          {/* Eliminated */}
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] px-4 py-3">
            <span className="font-ff-display text-[26px] font-extrabold leading-none text-[var(--ff-danger)]">{teamStats.eliminated}</span>
            <span className="mt-0.5 font-ff-ui text-[9px] text-[var(--ff-fg-faint)]">eliminated</span>
          </div>
          {/* Transfers */}
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] px-4 py-3">
            <span className="font-ff-display text-[26px] font-extrabold leading-none text-[var(--ff-gold)]">{teamStats.transfers}</span>
            <span className="mt-0.5 font-ff-ui text-[9px] text-[var(--ff-fg-faint)]">transfers</span>
          </div>
        </div>
      </div>

      {/* ── Squad ──────────────────────────────────────────────────────────── */}
      <section>
        {/* Mobile: featured full-width banner → drawn 2-col below
            md+:    featured portrait left column (bigger, glowing) → drawn 3-col grid right */}
        <div className="flex flex-col gap-2.5 md:flex-row md:items-stretch md:gap-4">

          {/* Featured — prominent left portrait column on md+ */}
          {featuredDisplay ? (
            <div className="relative flex flex-col pt-5 md:w-72 md:shrink-0 xl:w-80">
              {/* Star badge on outer wrapper — never clipped by overflow-hidden */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-orange-300/60 bg-orange-500 px-2.5 py-[4px] text-[10px] font-black text-zinc-950 shadow-lg whitespace-nowrap">
                <Crown size={9} className="fill-current shrink-0" />
                Star · 2x
              </div>
              <SquadCard
                team={featuredDisplay}
                isFeatured
                isModalOpen={modalTeam?.team.id === featuredDisplay.id}
                points={calculateTeamPoints(teamsById[featuredDisplay.id]) * 2}
                cardClass="aspect-[4/1] md:aspect-auto md:flex-1 rounded-2xl w-full"
                objectContain
                onExpand={() => {
                  const pts = calculateTeamPoints(teamsById[featuredDisplay.id]) * 2;
                  onTeamExpand(`featured-${featuredDisplay.id}`, featuredDisplay.id);
                  setModalTeam(m =>
                    m?.team.id === featuredDisplay.id ? null : { team: featuredDisplay, isFeatured: true, points: pts }
                  );
                }}
              />
              {/* Orange copper glow — outside the clipping container */}
              <div className="pointer-events-none absolute inset-0 mt-5 rounded-2xl shadow-[0_0_48px_rgba(245,158,11,0.25)]" aria-hidden />
            </div>
          ) : null}

          {/* Drawn teams — 2-col mobile, 3-col md+ (all 5 fit in 2 rows) */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:flex-1">
            {drawnDisplay.map((team) => (
              <SquadCard
                key={team.id}
                team={team}
                isFeatured={false}
                isModalOpen={modalTeam?.team.id === team.id}
                points={calculateTeamPoints(teamsById[team.id])}
                onExpand={() => {
                  const pts = calculateTeamPoints(teamsById[team.id]);
                  onTeamExpand(`drawn-${team.id}`, team.id);
                  setModalTeam(m =>
                    m?.team.id === team.id ? null : { team, isFeatured: false, points: pts }
                  );
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Team detail modal */}
      {modalTeam && (
        <TeamDetailModal
          team={modalTeam.team}
          points={modalTeam.points}
          isFeatured={modalTeam.isFeatured}
          teamMatchData={teamMatchData}
          teamsById={teamsById}
          allTeamNames={allTeamNames}
          onClose={() => setModalTeam(null)}
        />
      )}
    </div>
  );
}
