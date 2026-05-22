"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Clock,
  Crown,
} from "lucide-react";

import { TierPill } from "@/components/tier/TierPill";
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

function formatScoreOneDecimal(value: number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function drawnTierBorderClass(tier: number) {
  if (tier <= 2) return "border-[rgba(245,158,11,0.22)]";
  if (tier === 3) return "border-[rgba(249,115,22,0.26)]";
  return "border-[var(--ff-hairline-muted)]";
}

function FormChip({ value }: { value: MatchResult }) {
  const className =
    value === "W"
      ? "border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] text-[var(--ff-accent-text)]"
      : value === "D"
        ? "border-[var(--ff-hairline-strong)] bg-[var(--ff-bg-card-alt)] text-[var(--ff-fg-secondary)]"
        : "border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.12)] text-[var(--ff-danger)]";

  return (
    <div
      className={cn(
        "flex size-8 items-center justify-center rounded-lg border font-ff-ui text-xs font-bold",
        className
      )}
    >
      {value}
    </div>
  );
}

function HeroMicroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "red" | "amber";
}) {
  const valueClass =
    tone === "emerald"
      ? "text-[var(--ff-accent-text)]"
      : tone === "red"
        ? "text-[var(--ff-danger)]"
        : "text-[var(--ff-gold)]";

  return (
    <div className="text-right">
      <p
        className={cn(
          "font-ff-display text-[28px] font-bold leading-none tabular-nums tracking-tight",
          valueClass
        )}
      >
        {value}
      </p>
      <p className="font-ff-ui mt-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-[var(--ff-fg-faint)]">
        {label}
      </p>
    </div>
  );
}

function TeamStatsGrid({ team }: { team: TeamRecord | undefined }) {
  const stats = [
    { label: "Wins", value: asNumber(team?.wins) },
    { label: "Goals", value: asNumber(team?.goalsScored) },
    { label: "C.Sheets", value: asNumber(team?.cleanSheets) },
    { label: "Draws", value: asNumber(team?.draws) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] p-2.5 text-center"
        >
          <p className="font-ff-display text-lg font-bold tabular-nums text-[var(--ff-fg-primary)]">
            {item.value}
          </p>
          <p className="font-ff-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--ff-fg-faint)]">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function PortfolioTeamCard({
  team,
  teamKey,
  isFeatured = false,
  expandedTeam,
  teamMatchData,
  teamsById,
  onTeamExpand,
  calculateTeamPoints,
  enterDelayMs,
}: {
  team: DashboardTeam;
  teamKey: string;
  isFeatured?: boolean;
  expandedTeam: string | null;
  teamMatchData: Record<string, TeamMatchState>;
  teamsById: Record<string, TeamRecord>;
  onTeamExpand: (teamKey: string, teamId: string) => void;
  calculateTeamPoints: (team: Record<string, unknown> | null | undefined) => number;
  enterDelayMs?: number;
}) {
  const isExpanded = expandedTeam === teamKey;
  const isEliminated = team.isEliminated === true;
  const points = calculateTeamPoints(teamsById[team.id]);
  const teamState = teamMatchData[team.id];
  const nextMatch = teamState?.nextMatch ?? null;
  const opponentName = nextMatch
    ? teamsById[nextMatch.opponentId]?.name ?? "TBD"
    : null;

  const tier1Chrome = isFeatured && !isEliminated;
  const compact = !isFeatured;

  return (
    <div
      className={cn(
        "relative overflow-hidden border transition-all duration-300",
        compact ? "rounded-xl" : "rounded-2xl",
        tier1Chrome &&
          "border-[rgba(245,158,11,0.28)] bg-[linear-gradient(160deg,#1c1500_0%,#111318_60%)]",
        !tier1Chrome &&
          !isEliminated &&
          cn("bg-[var(--ff-bg-card)]", drawnTierBorderClass(team.tier)),
        isEliminated &&
          "border-[rgba(239,68,68,0.35)] bg-[var(--ff-bg-card)] opacity-[0.55]",
        isExpanded && "ring-2 ring-[var(--ff-accent-border)]",
        enterDelayMs != null && "ff-squad-stagger"
      )}
      style={
        enterDelayMs != null ? { animationDelay: `${enterDelayMs}ms` } : undefined
      }
    >
      {isEliminated ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-[var(--ff-danger)]"
          aria-hidden
        />
      ) : tier1Chrome ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-[var(--ff-gold)] via-[var(--ff-gold)]/70 to-transparent"
          aria-hidden
        />
      ) : null}
      <button
        onClick={() => onTeamExpand(teamKey, team.id)}
        className={cn(
          "w-full text-left",
          tier1Chrome
            ? "px-4 py-4 sm:px-4 sm:py-[18px]"
            : compact
              ? "px-3 py-3.5 sm:px-3 sm:py-3.5"
              : "p-4 sm:p-5"
        )}
      >
        {compact ? (
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "relative size-[26px] shrink-0 overflow-hidden rounded-md border bg-black/30",
                isEliminated
                  ? "border-[var(--ff-danger)]/35"
                  : "border-[var(--ff-hairline-muted)]"
              )}
            >
              {team.flagUrl ? (
                <img
                  src={team.flagUrl}
                  alt={team.name}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-ff-display text-base font-bold leading-tight tracking-wide text-[var(--ff-fg-primary)]">
                {team.name}
              </p>
              <p className="mt-0.5 font-ff-ui text-[10px] leading-snug text-[var(--ff-fg-faint)]">
                <span
                  className={cn(
                    "font-semibold",
                    isEliminated
                      ? "text-[var(--ff-danger)]"
                      : "text-[var(--ff-accent-text)]"
                  )}
                >
                  {isEliminated ? "Eliminated" : "Active"}
                </span>
                <span className="mx-1 text-[var(--ff-hairline-strong)]">·</span>
                <span>Tier {team.tier}</span>
                <span className="mx-1 text-[var(--ff-hairline-strong)]">·</span>
                <span>Group {team.group}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  "font-ff-display text-[28px] font-extrabold leading-none tabular-nums tracking-tight",
                  isEliminated ? "text-[var(--ff-danger)]" : "text-[var(--ff-fg-primary)]"
                )}
              >
                {points}
              </span>
              <ChevronRight
                className={cn(
                  "size-5 shrink-0 text-[var(--ff-fg-secondary)] transition-transform",
                  isExpanded ? "rotate-90" : ""
                )}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "relative overflow-hidden rounded-xl border bg-black/30",
                    tier1Chrome ? "size-[34px] shrink-0" : "h-14 w-14 shrink-0",
                    isFeatured ? "border-[var(--ff-gold)]/45" : "border-white/15"
                  )}
                >
                  {team.flagUrl ? (
                    <img
                      src={team.flagUrl}
                      alt={team.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  {isFeatured ? (
                    <div className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-[var(--ff-accent)] text-[var(--ff-fg-primary)]">
                      <Crown className="size-3" />
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate font-black text-[var(--ff-fg-primary)]",
                      tier1Chrome ? "font-ff-display text-lg tracking-wide" : "text-lg"
                    )}
                  >
                    {team.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        isEliminated
                          ? "border-[var(--ff-danger)]/40 bg-[rgba(239,68,68,0.12)] text-[var(--ff-danger)]"
                          : "border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] text-[var(--ff-accent-text)]"
                      )}
                    >
                      {isEliminated ? "Eliminated" : "Active"}
                    </span>
                    <span className="font-ff-ui text-xs text-[var(--ff-fg-secondary)]">
                      Group {team.group}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p
                    className={cn(
                      "font-ff-display font-extrabold leading-none tracking-tight",
                      tier1Chrome ? "text-[42px]" : "text-3xl",
                      isEliminated ? "text-[var(--ff-danger)]" : "text-[var(--ff-fg-primary)]"
                    )}
                  >
                    {points}
                  </p>
                  <p className="font-ff-ui mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--ff-fg-faint)]">
                    Points
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "size-5 text-[var(--ff-fg-secondary)] transition-transform",
                    isExpanded ? "rotate-90" : ""
                  )}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <TierPill tier={team.tier} />
              {isFeatured ? (
                <div className="rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.1)] px-2.5 py-1 font-ff-ui text-[10px] font-bold uppercase tracking-widest text-[var(--ff-gold)]">
                  Star Team · 2x
                </div>
              ) : null}
            </div>
          </>
        )}
      </button>

      {isExpanded ? (
        <div className="border-t border-[var(--ff-hairline-muted)] px-3 pb-4 pt-3 sm:px-4 sm:pb-5 sm:pt-4">
          {isEliminated ? (
            <div className="rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.1)] p-3 text-center font-ff-ui text-sm text-[var(--ff-danger)]">
              This team has been eliminated.
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
            <div className="rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] p-2.5 sm:p-3">
              <p className="mb-2 font-ff-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">
                Recent Form
              </p>
              {teamState?.loading ? (
                <div className="flex gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="size-8 animate-pulse rounded-lg bg-[var(--ff-hairline-muted)]"
                    />
                  ))}
                </div>
              ) : teamState?.recentForm?.length ? (
                <div className="flex gap-1.5">
                  {teamState.recentForm.map((value, idx) => (
                    <FormChip key={idx} value={value} />
                  ))}
                </div>
              ) : (
                <p className="font-ff-ui text-sm text-[var(--ff-fg-secondary)]">
                  No matches yet
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] p-2.5 sm:p-3">
              <div className="mb-2 flex items-center gap-2 font-ff-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">
                <Clock className="size-3 shrink-0 opacity-80" />
                Next Match
              </div>
              {teamState?.loading ? (
                <div className="space-y-1.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-[var(--ff-hairline-muted)]" />
                  <div className="h-3 w-32 animate-pulse rounded bg-[var(--ff-hairline-muted)]" />
                </div>
              ) : nextMatch ? (
                <>
                  <p className="font-ff-ui font-bold text-[var(--ff-fg-primary)]">
                    vs {opponentName}
                  </p>
                  <p className="font-ff-ui text-xs text-[var(--ff-fg-secondary)]">
                    {formatMatchDate(nextMatch.scheduledAt)}
                  </p>
                </>
              ) : (
                <p className="font-ff-ui text-sm text-[var(--ff-fg-secondary)]">
                  No upcoming matches
                </p>
              )}
            </div>

            <div className="col-span-2 rounded-xl border border-[var(--ff-hairline-muted)] bg-[var(--ff-bg-card-alt)] p-2.5 sm:p-3">
              <p className="mb-2 font-ff-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">
                Stats
              </p>
              <TeamStatsGrid team={teamsById[team.id]} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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

    if (prefersReducedMotion) {
      setDisplayScore(target);
      countUpDoneRef.current = true;
      return;
    }

    if (countUpDoneRef.current) {
      setDisplayScore(target);
      return;
    }

    let countUpMs = 950;
    if (typeof window !== "undefined") {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--ff-count-up-ms")
        .trim();
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        countUpMs = parsed;
      }
    }

    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / countUpMs);
      setDisplayScore(target * easeOutCubic(t));
      if (t < 1) {
        countUpRafRef.current = requestAnimationFrame(tick);
      } else {
        countUpRafRef.current = null;
        countUpDoneRef.current = true;
      }
    };

    countUpRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (countUpRafRef.current != null) {
        cancelAnimationFrame(countUpRafRef.current);
        countUpRafRef.current = null;
      }
    };
  }, [userStats.score, prefersReducedMotion, userId]);

  const scoreDisplay = useMemo(
    () => formatScoreOneDecimal(displayScore),
    [displayScore]
  );

  return (
    <div className="mb-6 space-y-6">
      <div className="mb-7 grid grid-cols-1 items-end gap-y-5 lg:grid-cols-[1fr_auto] lg:gap-x-6 lg:gap-y-0">
        <div className="min-w-0">
          <p className="font-ff-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3d4a58]">
            Total points
          </p>
          <p className="font-ff-display text-[clamp(3rem,11vw,6rem)] font-extrabold leading-[0.9] tracking-[-0.02em] text-[var(--ff-fg-primary)]">
            {scoreDisplay}
          </p>
          {userStats.rank ? (
            <div
              className={cn(
                "mt-2.5 flex flex-wrap items-end gap-x-3 gap-y-1",
                !prefersReducedMotion && "ff-rank-chip-in"
              )}
            >
              <span className="font-ff-display text-[30px] font-extrabold leading-none text-[var(--ff-gold)] tabular-nums">
                #{userStats.rank}
              </span>
              <div className="font-ff-ui text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">
                <div>of {leaderboardCount}</div>
                {rankTrendCaption ? (
                  <div className="mt-0.5 normal-case tracking-normal text-[var(--ff-fg-secondary)]">
                    {rankTrendCaption}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="font-ff-ui mt-2.5 text-xs font-medium text-[var(--ff-fg-secondary)]">
              Unranked
            </p>
          )}
        </div>

        <div className="flex justify-end gap-8 sm:gap-10 lg:flex-col lg:items-end lg:gap-3 lg:pl-1">
          <HeroMicroStat label="Active" value={teamStats.active} tone="emerald" />
          <HeroMicroStat label="Eliminated" value={teamStats.eliminated} tone="red" />
          <HeroMicroStat label="Transfer" value={teamStats.transfers} tone="amber" />
        </div>
      </div>

      <section className="space-y-3">
        <div className="mb-3.5 flex min-h-[1.25rem] items-end gap-2">
          <span className="font-ff-ui shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3d4a58]">
            Your squad
          </span>
          <div
            className="mb-1 h-px min-w-[1rem] flex-1 bg-[rgba(255,255,255,0.05)]"
            aria-hidden
          />
        </div>

        {featuredDisplay ? (
          <div className="mb-2.5">
            <PortfolioTeamCard
              team={featuredDisplay}
              teamKey={`featured-${featuredDisplay.id}`}
              isFeatured
              expandedTeam={expandedTeam}
              teamMatchData={teamMatchData}
              teamsById={teamsById}
              onTeamExpand={onTeamExpand}
              calculateTeamPoints={calculateTeamPoints}
              enterDelayMs={60}
            />
          </div>
        ) : null}

        {drawnDisplay.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2">
            {drawnDisplay.map((team, i) => (
              <PortfolioTeamCard
                key={team.id}
                team={team}
                teamKey={`drawn-${team.id}`}
                expandedTeam={expandedTeam}
                teamMatchData={teamMatchData}
                teamsById={teamsById}
                onTeamExpand={onTeamExpand}
                calculateTeamPoints={calculateTeamPoints}
                enterDelayMs={60 + (i + (featuredDisplay ? 1 : 0)) * 60}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
