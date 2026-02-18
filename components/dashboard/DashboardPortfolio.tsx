"use client";

import { useEffect, useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Crown,
  Minus,
} from "lucide-react";

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

function tierLabel(tier: number) {
  if (tier === 1) return "Elite";
  if (tier === 2) return "Strong";
  if (tier === 3) return "Competitive";
  return "Underdog";
}

function tierPillClass(tier: number) {
  if (tier === 1)
    return "bg-gradient-to-br from-amber-400/20 to-yellow-500/10 text-amber-100 border-amber-400/45 shadow-[0_8px_18px_rgba(251,191,36,0.28)]";
  if (tier === 2)
    return "bg-gradient-to-br from-slate-300/20 to-zinc-300/10 text-slate-100 border-slate-300/45 shadow-[0_8px_18px_rgba(203,213,225,0.18)]";
  if (tier === 3)
    return "bg-gradient-to-br from-orange-500/18 to-amber-600/12 text-orange-100 border-orange-500/45 shadow-[0_8px_18px_rgba(249,115,22,0.20)]";
  return "bg-gradient-to-br from-zinc-500/18 to-zinc-700/14 text-zinc-100 border-zinc-400/35 shadow-[0_8px_18px_rgba(113,113,122,0.20)]";
}

function TierPill({ tier }: { tier: number }) {
  return (
    <div
      className={[
        "inline-flex flex-col items-center rounded-xl border px-2.5 py-1.5 text-center min-w-[88px]",
        tierPillClass(tier),
      ].join(" ")}
    >
      <span className="text-[10px] font-black leading-none tracking-[0.08em] uppercase">
        Tier {tier}
      </span>
      <span className="text-[11px] font-semibold leading-tight mt-0.5">
        {tierLabel(tier)}
      </span>
    </div>
  );
}

function asNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function FormChip({ value }: { value: MatchResult }) {
  const className =
    value === "W"
      ? "bg-primary/20 text-primary border-primary/30"
      : value === "D"
        ? "bg-muted text-muted-foreground border-border"
        : "bg-destructive/20 text-destructive border-destructive/30";

  return (
    <div
      className={[
        "w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold",
        className,
      ].join(" ")}
    >
      {value}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "primary" | "destructive";
}) {
  const valueTone =
    tone === "primary"
      ? "text-primary"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4 text-center">
      <p className={["text-2xl sm:text-3xl font-black", valueTone].join(" ")}>
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
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
          className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-center"
        >
          <p className="text-lg font-black text-foreground">{item.value}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
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
}: {
  team: DashboardTeam;
  teamKey: string;
  isFeatured?: boolean;
  expandedTeam: string | null;
  teamMatchData: Record<string, TeamMatchState>;
  teamsById: Record<string, TeamRecord>;
  onTeamExpand: (teamKey: string, teamId: string) => void;
  calculateTeamPoints: (team: Record<string, unknown> | null | undefined) => number;
}) {
  const isExpanded = expandedTeam === teamKey;
  const isEliminated = team.isEliminated === true;
  const points = calculateTeamPoints(teamsById[team.id]);
  const teamState = teamMatchData[team.id];
  const nextMatch = teamState?.nextMatch ?? null;
  const opponentName = nextMatch
    ? teamsById[nextMatch.opponentId]?.name ?? "TBD"
    : null;

  return (
    <div
      className={[
        "rounded-2xl border overflow-hidden transition-all duration-300",
        isExpanded ? "ring-2 ring-primary/30 border-primary/40" : "border-border",
        isEliminated ? "opacity-70" : "bg-card/95",
        isFeatured ? "shadow-[0_14px_34px_rgba(16,185,129,0.16)]" : "",
      ].join(" ")}
    >
      <button
        onClick={() => onTeamExpand(teamKey, team.id)}
        className="w-full p-4 sm:p-5 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div
              className={[
                "relative w-14 h-14 rounded-xl overflow-hidden border bg-black/30",
                isFeatured ? "border-primary/50" : "border-white/15",
              ].join(" ")}
            >
              {team.flagUrl ? (
                <img
                  src={team.flagUrl}
                  alt={team.name}
                  className="w-full h-full object-cover"
                />
              ) : null}
              {isFeatured ? (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Crown className="w-3 h-3" />
                </div>
              ) : null}
            </div>

            <div className="min-w-0">
              <p className="text-lg font-black text-foreground truncate">
                {team.name}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={[
                    "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                    isEliminated
                      ? "border-destructive/40 text-destructive bg-destructive/10"
                      : "border-primary/30 text-primary bg-primary/10",
                  ].join(" ")}
                >
                  {isEliminated ? "Eliminated" : "Active"}
                </span>
                <span className="text-xs text-muted-foreground">Group {team.group}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-3xl font-black text-foreground leading-none">{points}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
                Points
              </p>
            </div>
            <ChevronRight
              className={[
                "w-5 h-5 text-muted-foreground transition-transform",
                isExpanded ? "rotate-90" : "",
              ].join(" ")}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <TierPill tier={team.tier} />
          {isFeatured ? (
            <div className="rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-widest font-black text-primary">
              Featured 2x
            </div>
          ) : null}
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-white/10 px-4 sm:px-5 pb-5 pt-4">
          {isEliminated ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive text-center">
              This team has been eliminated.
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3 mt-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Recent Form
              </p>
              {teamState?.loading ? (
                <div className="flex gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : teamState?.recentForm?.length ? (
                <div className="flex gap-1.5">
                  {teamState.recentForm.map((value, idx) => (
                    <FormChip key={idx} value={value} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No matches yet</p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                <Clock className="w-3 h-3" />
                Next Match
              </div>
              {teamState?.loading ? (
                <div className="space-y-1.5">
                  <div className="h-4 bg-muted rounded animate-pulse w-24" />
                  <div className="h-3 bg-muted rounded animate-pulse w-32" />
                </div>
              ) : nextMatch ? (
                <>
                  <p className="font-bold text-foreground">vs {opponentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMatchDate(nextMatch.scheduledAt)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming matches</p>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
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

  return (
    <div className="mb-6 space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/20 via-card/95 to-card p-4 sm:p-5">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Total Points
            </p>
            <p className="text-5xl sm:text-6xl font-black text-foreground leading-none">
              {userStats.score.toLocaleString()}
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Rank
              </p>
              {userStats.rank ? (
                <p className="text-xl sm:text-2xl font-black text-foreground mt-1">
                  #{userStats.rank}
                  <span className="text-sm font-semibold text-muted-foreground ml-1">
                    / {leaderboardCount}
                  </span>
                </p>
              ) : (
                <p className="text-base font-semibold text-muted-foreground mt-1">
                  Unranked
                </p>
              )}
            </div>
            <div
              className={[
                "rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-1.5",
                rankTrend === "up"
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : rankTrend === "down"
                    ? "border-destructive/40 bg-destructive/15 text-destructive"
                    : "border-white/10 bg-white/5 text-muted-foreground",
              ].join(" ")}
            >
              {rankTrend === "up" ? <ArrowUpRight className="w-4 h-4" /> : null}
              {rankTrend === "down" ? <ArrowDownRight className="w-4 h-4" /> : null}
              {rankTrend === "same" ? <Minus className="w-4 h-4" /> : null}
              {rankTrend === "new"
                ? "First rank"
                : rankTrend === "up"
                  ? `Up ${rankDelta || 1}`
                  : rankTrend === "down"
                    ? `Down ${rankDelta || 1}`
                    : rankTrend === "same"
                      ? "No change"
                      : "Live"}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 lg:grid-cols-1 gap-3">
          <SummaryTile label="Active" value={teamStats.active} tone="primary" />
          <SummaryTile
            label="Eliminated"
            value={teamStats.eliminated}
            tone="destructive"
          />
          <SummaryTile label="Transfers" value={teamStats.transfers} />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Your Teams
        </h2>

        {featuredDisplay ? (
          <PortfolioTeamCard
            team={featuredDisplay}
            teamKey={`featured-${featuredDisplay.id}`}
            isFeatured
            expandedTeam={expandedTeam}
            teamMatchData={teamMatchData}
            teamsById={teamsById}
            onTeamExpand={onTeamExpand}
            calculateTeamPoints={calculateTeamPoints}
          />
        ) : null}

        {drawnDisplay.map((team) => (
          <PortfolioTeamCard
            key={team.id}
            team={team}
            teamKey={`drawn-${team.id}`}
            expandedTeam={expandedTeam}
            teamMatchData={teamMatchData}
            teamsById={teamsById}
            onTeamExpand={onTeamExpand}
            calculateTeamPoints={calculateTeamPoints}
          />
        ))}
      </section>
    </div>
  );
}
