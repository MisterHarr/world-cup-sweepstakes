"use client";

import { ChevronRight, Clock, Crown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
    return "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-200 border-yellow-500/40 shadow-sm shadow-yellow-500/20";
  if (tier === 2)
    return "bg-gradient-to-r from-slate-400/20 to-gray-300/20 text-slate-100 border-slate-400/40 shadow-sm shadow-slate-400/20";
  if (tier === 3)
    return "bg-gradient-to-r from-orange-600/20 to-amber-700/20 text-orange-200 border-orange-600/40 shadow-sm shadow-orange-600/20";
  return "bg-gradient-to-r from-rose-900/20 to-red-950/20 text-rose-200 border-rose-800/40 shadow-sm shadow-rose-900/20";
}

function TierPill({ tier }: { tier: number }) {
  return (
    <span
      className={[
        "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border",
        tierPillClass(tier),
      ].join(" ")}
    >
      Tier {tier} - {tierLabel(tier)}
    </span>
  );
}

export default function DashboardPortfolio({
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
  return (
    <div className="mb-6 space-y-6">
      {/* Points Summary Card */}
      <div className="bg-gradient-to-br from-primary/20 via-card to-card border border-primary/30 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Points</p>
            <p className="text-5xl font-bold text-foreground">{userStats.score.toLocaleString()}</p>
          </div>
          <div className="text-right">
            {userStats.rank ? (
              <p className="text-xs text-muted-foreground mt-1">
                Rank #{userStats.rank} of {leaderboardCount}
              </p>
            ) : (
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Team Status Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-background/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{teamStats.active}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="bg-background/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{teamStats.eliminated}</p>
            <p className="text-xs text-muted-foreground">Eliminated</p>
          </div>
          <div className="bg-background/50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{teamStats.transfers}</p>
            <p className="text-xs text-muted-foreground">Transfers</p>
          </div>
        </div>
      </div>

      {/* Teams List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Your Teams
        </h2>

        {/* Featured Team */}
        {featuredDisplay && (
          <div className="bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:ring-2 hover:ring-primary/30">
            <button
              onClick={() =>
                onTeamExpand(`featured-${featuredDisplay.id}`, featuredDisplay.id)
              }
              className="w-full p-4 flex items-center gap-4 text-left"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary shadow-lg shadow-primary/20">
                  {featuredDisplay.flagUrl && (
                    <img
                      src={featuredDisplay.flagUrl}
                      alt={featuredDisplay.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Crown className="w-3 h-3 text-primary-foreground" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-lg">{featuredDisplay.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Your Pick
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <TierPill tier={featuredDisplay.tier} />
                  <span className="text-xs text-muted-foreground">
                    Group {featuredDisplay.group}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">
                  {calculateTeamPoints(teamsById[featuredDisplay.id])}
                </p>
                <p className="text-xs text-muted-foreground">pts</p>
              </div>
              <ChevronRight
                className={`w-5 h-5 text-muted-foreground transition-transform ${
                  expandedTeam === `featured-${featuredDisplay.id}`
                    ? "rotate-90"
                    : ""
                }`}
              />
            </button>

            {/* Expanded Details */}
            {expandedTeam === `featured-${featuredDisplay.id}` && (
              <div className="px-4 pb-4 border-t border-border/50">
                <div className="pt-4 space-y-4">
                  {/* Recent Form */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Recent Form</p>
                    {teamMatchData[featuredDisplay.id]?.loading ? (
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : teamMatchData[featuredDisplay.id]?.recentForm?.length > 0 ? (
                      <div className="flex gap-1">
                        {teamMatchData[featuredDisplay.id].recentForm.map((result, i) => (
                          <div
                            key={i}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                              result === "W"
                                ? "bg-primary/20 text-primary"
                                : result === "D"
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-destructive/20 text-destructive"
                            }`}
                          >
                            {result}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No matches yet</p>
                    )}
                  </div>

                  {/* Next Match */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Clock className="w-3 h-3" />
                      <span>Next Match</span>
                    </div>
                    {teamMatchData[featuredDisplay.id]?.loading ? (
                      <div className="space-y-1">
                        <div className="h-4 bg-muted rounded animate-pulse w-24" />
                        <div className="h-3 bg-muted rounded animate-pulse w-32" />
                      </div>
                    ) : teamMatchData[featuredDisplay.id]?.nextMatch ? (
                      <>
                        <p className="font-medium text-foreground">
                          vs {teamsById[teamMatchData[featuredDisplay.id].nextMatch!.opponentId]?.name || "TBD"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMatchDate(
                            teamMatchData[featuredDisplay.id].nextMatch!.scheduledAt
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No upcoming matches</p>
                    )}
                  </div>

                  {/* Points Breakdown */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Points Breakdown</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">
                          {teamsById[featuredDisplay.id]?.wins ?? 0}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Wins</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">
                          {teamsById[featuredDisplay.id]?.goalsScored ?? 0}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Goals</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">
                          {teamsById[featuredDisplay.id]?.cleanSheets ?? 0}
                        </p>
                        <p className="text-[10px] text-muted-foreground">C.Sheets</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">
                          {teamsById[featuredDisplay.id]?.draws ?? 0}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Draws</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drawn Teams */}
        {drawnDisplay.map((team) => {
          const isEliminated = team.isEliminated === true;
          const teamPoints = calculateTeamPoints(teamsById[team.id]);
          const teamKey = `drawn-${team.id}`;

          return (
            <div
              key={team.id}
              className={`bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 ${
                isEliminated ? "opacity-60" : ""
              } ${expandedTeam === teamKey ? "ring-2 ring-primary/30" : ""}`}
            >
              <button
                onClick={() => onTeamExpand(teamKey, team.id)}
                className="w-full p-4 flex items-center gap-4 text-left"
              >
                <div className="relative w-12 h-12">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                    {team.flagUrl && (
                      <img src={team.flagUrl} alt={team.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  {isEliminated && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border-2 border-destructive rounded-full flex items-center justify-center bg-background/80">
                        <span className="text-destructive text-[10px] font-bold">OUT</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <span className="font-bold text-foreground">{team.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <TierPill tier={team.tier} />
                    <span className="text-xs text-muted-foreground">Group {team.group}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{teamPoints}</p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </div>
                <ChevronRight
                  className={`w-5 h-5 text-muted-foreground transition-transform ${
                    expandedTeam === teamKey ? "rotate-90" : ""
                  }`}
                />
              </button>

              {/* Expanded Details */}
              {expandedTeam === teamKey && !isEliminated && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <div className="pt-4 space-y-4">
                    {/* Recent Form */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Recent Form</p>
                      {teamMatchData[team.id]?.loading ? (
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
                          ))}
                        </div>
                      ) : teamMatchData[team.id]?.recentForm?.length > 0 ? (
                        <div className="flex gap-1">
                          {teamMatchData[team.id].recentForm.map((result, i) => (
                            <div
                              key={i}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                result === "W"
                                  ? "bg-primary/20 text-primary"
                                  : result === "D"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-destructive/20 text-destructive"
                              }`}
                            >
                              {result}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No matches yet</p>
                      )}
                    </div>

                    {/* Next Match */}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3 h-3" />
                        <span>Next Match</span>
                      </div>
                      {teamMatchData[team.id]?.loading ? (
                        <div className="space-y-1">
                          <div className="h-4 bg-muted rounded animate-pulse w-24" />
                          <div className="h-3 bg-muted rounded animate-pulse w-32" />
                        </div>
                      ) : teamMatchData[team.id]?.nextMatch ? (
                        <>
                          <p className="font-medium text-foreground">
                            vs {teamsById[teamMatchData[team.id].nextMatch!.opponentId]?.name || "TBD"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatMatchDate(teamMatchData[team.id].nextMatch!.scheduledAt)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No upcoming matches</p>
                      )}
                    </div>

                    {/* Points Breakdown */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Points Breakdown</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">
                            {teamsById[team.id]?.wins ?? 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Wins</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">
                            {teamsById[team.id]?.goalsScored ?? 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Goals</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">
                            {teamsById[team.id]?.cleanSheets ?? 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">C.Sheets</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-foreground">
                            {teamsById[team.id]?.draws ?? 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Draws</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
