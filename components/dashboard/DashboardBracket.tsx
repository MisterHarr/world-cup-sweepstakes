"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, ChevronLeft, ChevronRight, Clock, TrendingUp, Tv, Zap } from "lucide-react";
import {
  stageLabel,
  type BracketMatch,
  type BracketStage,
} from "@/lib/bracketUtils";

const DashboardBracket = ({
  stages = [],
  matches = {},
  isLoading = false,
  teamNames = {},
  teamFlags = {},
  userTeamIds = [],
  activeStageId,
  onStageChange,
  lastUpdated,
}: {
  stages: BracketStage[];
  matches: Record<string, BracketMatch[]>;
  isLoading: boolean;
  teamNames?: Record<string, string>;
  teamFlags?: Record<string, string>;
  userTeamIds?: string[];
  activeStageId?: string;
  onStageChange?: (stageId: string) => void;
  lastUpdated?: string;
}) => {
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<
    "live" | "upcoming" | "results"
  >("live");
  const [notifyMap, setNotifyMap] = useState<Record<string, boolean>>({});

  const stagesToUse = useMemo<BracketStage[]>(
    () => (stages.length > 0 ? stages : [{ id: "EMPTY_STAGE", name: "Match Center" }]),
    [stages]
  );
  const controlledStageIdx = useMemo(() => {
    if (!activeStageId) return -1;
    return stagesToUse.findIndex((stage) => stage.id === activeStageId);
  }, [activeStageId, stagesToUse]);
  const hasRealStages = stages.length > 0;
  const userTeamSet = useMemo(
    () => new Set((userTeamIds ?? []).map((id) => String(id))),
    [userTeamIds]
  );

  const stageIndexSource = controlledStageIdx >= 0 ? controlledStageIdx : activeStageIdx;
  const safeStageIndex = Math.min(
    stageIndexSource,
    Math.max(stagesToUse.length - 1, 0)
  );
  const activeStage = stagesToUse[safeStageIndex];
  const currentMatches = activeStage ? matches[activeStage.id] || [] : [];
  const resolveName = (teamId?: string) =>
    teamId ? teamNames[teamId] ?? teamId : "TBD";
  const resolveFlag = (teamId?: string) =>
    teamId ? teamFlags[teamId] ?? "" : "";
  const isUserTeam = (teamId?: string) =>
    teamId ? userTeamSet.has(String(teamId)) : false;
  const formatKickoff = (kickoff?: string) => {
    if (!kickoff) return "";
    const dt = new Date(kickoff);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatUpdated = (value?: string) => {
    if (!value) return "";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const navigate = (dir: "next" | "prev") => {
    const lastIdx = stagesToUse.length - 1;
    const nextIdx =
      dir === "next"
        ? Math.min(safeStageIndex + 1, lastIdx)
        : Math.max(safeStageIndex - 1, 0);
    if (nextIdx === safeStageIndex) return;

    const nextStage = stagesToUse[nextIdx];
    if (activeStageId && onStageChange && nextStage) {
      onStageChange(nextStage.id);
      return;
    }

    setActiveStageIdx(nextIdx);
  };

  useEffect(() => {
    const stage = stagesToUse[safeStageIndex];
    if (!stage || !onStageChange) return;
    if (activeStageId && stage.id === activeStageId) return;
    onStageChange(stage.id);
  }, [activeStageId, onStageChange, safeStageIndex, stagesToUse]);

  const normalizeStatus = (status?: string) => (status || "").toUpperCase();
  const isLiveMatch = (match: BracketMatch) =>
    Boolean(match.isLive) || normalizeStatus(match.status) === "LIVE";
  const isFinishedMatch = (match: BracketMatch) => {
    const status = normalizeStatus(match.status);
    return status === "FINISHED" || status === "FINAL" || status === "FT";
  };

  const liveMatches = currentMatches.filter(isLiveMatch);
  const finishedMatches = currentMatches.filter(isFinishedMatch);
  const upcomingMatches = currentMatches.filter(
    (match) => !isLiveMatch(match) && !isFinishedMatch(match)
  );

  const liveMatchCount = liveMatches.length;
  const liveYourTeamCount = liveMatches.filter(
    (match) => isUserTeam(match.t1) || isUserTeam(match.t2)
  ).length;

  const toggleNotify = (matchId: string) => {
    setNotifyMap((prev) => ({ ...prev, [matchId]: !prev[matchId] }));
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {lastUpdated ? (
        <div className="text-xs text-muted-foreground/70">
          Last updated: {formatUpdated(lastUpdated)}
        </div>
      ) : null}

      {/* Live Points Banner */}
      {liveYourTeamCount > 0 && (
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Points Gained Live</p>
                <p className="text-xs text-muted-foreground">From your teams currently playing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-primary">+12</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
              <Tv className="w-5 h-5 text-destructive" />
            </div>
            {liveMatchCount > 0 && (
              <>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-ping" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full" />
              </>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Match Center</h2>
            <p className="text-xs text-muted-foreground">
              {hasRealStages
                ? `${liveMatchCount} match${liveMatchCount === 1 ? "" : "es"} live`
                : "Feed unavailable"}
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground/70">
          {activeStage?.name ?? stageLabel(activeStage?.id ?? "")}
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 w-fit">
        v0 layout active
      </div>

      {liveMatchCount > 0 && (
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  {liveYourTeamCount > 0 ? "Teams Live" : "Matches Live"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {liveYourTeamCount > 0
                    ? "Your teams currently playing"
                    : "Live matches underway"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-primary">
                {liveYourTeamCount > 0 ? liveYourTeamCount : liveMatchCount}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-card/70 p-3 rounded-xl border border-border">
        <button
          onClick={() => navigate("prev")}
          disabled={safeStageIndex === 0}
          className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="text-center">
          <div className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest mb-1">
            Current Stage
          </div>
          <div className="text-sm font-semibold text-foreground">
            {activeStage?.name ?? "Stage"}
          </div>
        </div>

        <button
          onClick={() => navigate("next")}
          disabled={safeStageIndex === stagesToUse.length - 1}
          className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Enhanced Tabs */}
      <div className="inline-flex bg-muted/50 rounded-lg p-1 border border-border">
        <button
          onClick={() => setActiveTab("live")}
          className={[
            "flex items-center justify-center gap-2 px-6 py-2.5 rounded-md text-sm font-semibold transition-all",
            activeTab === "live"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <span
            className={[
              "w-2 h-2 rounded-full bg-destructive",
              liveMatchCount > 0 ? "animate-pulse" : "",
            ].join(" ")}
          />
          Live
        </button>
        <button
          onClick={() => setActiveTab("upcoming")}
          className={[
            "px-6 py-2.5 rounded-md text-sm font-semibold transition-all",
            activeTab === "upcoming"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab("results")}
          className={[
            "px-6 py-2.5 rounded-md text-sm font-semibold transition-all",
            activeTab === "results"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          Results
        </button>
      </div>

      {activeTab === "live" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground/70">
              Loading matches...
            </div>
          ) : liveMatches.length > 0 ? (
            liveMatches.map((match) => {
              const yourTeam = isUserTeam(match.t1) || isUserTeam(match.t2);
              const t1Code =
                match.t1?.substring(0, 3).toUpperCase() || "TBD";
              const t2Code =
                match.t2?.substring(0, 3).toUpperCase() || "TBD";

              return (
                <div
                  key={match.id}
                  className={[
                    "bg-card border rounded-xl overflow-hidden",
                    yourTeam ? "border-primary/50" : "border-border",
                  ].join(" ")}
                >
                  <div className="bg-white/5 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      <span className="text-sm font-medium text-destructive">
                        LIVE
                      </span>
                    </div>
                    {yourTeam && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                        Your Team Playing
                      </span>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 text-center">
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-border flex items-center justify-center mx-auto mb-2 overflow-hidden">
                          {resolveFlag(match.t1) ? (
                            <img
                              src={resolveFlag(match.t1)}
                              alt={resolveName(match.t1)}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t1Code}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-foreground">{t1Code}</p>
                      </div>

                      <div className="px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl font-bold text-foreground">
                            {match.s1 !== undefined ? match.s1 : "-"}
                          </span>
                          <span className="text-2xl text-muted-foreground">
                            -
                          </span>
                          <span className="text-4xl font-bold text-foreground">
                            {match.s2 !== undefined ? match.s2 : "-"}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 text-center">
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-border flex items-center justify-center mx-auto mb-2 overflow-hidden">
                          {resolveFlag(match.t2) ? (
                            <img
                              src={resolveFlag(match.t2)}
                              alt={resolveName(match.t2)}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t2Code}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-foreground">{t2Code}</p>
                      </div>
                    </div>

                    {match.impact ? (
                      <div className="mt-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary text-xs font-semibold px-2 py-1">
                          <TrendingUp size={14} />
                          {match.impact}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-border px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Match Events
                    </p>
                    <div className="text-sm text-muted-foreground">
                      Live events will appear here.
                    </div>
                  </div>

                  {(match.kickoffTime || match.updatedAt) && (
                    <div className="border-t border-border px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {match.kickoffTime
                        ? `Kickoff ${formatKickoff(match.kickoffTime)}`
                        : `Updated ${formatUpdated(match.updatedAt)}`}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No live matches right now</p>
              <p className="text-sm mt-1">
                Live games will appear here when they start
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "upcoming" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground/70">
              Loading matches...
            </div>
          ) : upcomingMatches.length > 0 ? (
            upcomingMatches.map((match) => {
              const yourTeam =
                isUserTeam(match.t1) || isUserTeam(match.t2);
              const t1Code =
                match.t1?.substring(0, 3).toUpperCase() || "TBD";
              const t2Code =
                match.t2?.substring(0, 3).toUpperCase() || "TBD";
              const kickoffLabel = match.kickoffTime
                ? formatKickoff(match.kickoffTime)
                : "Time TBD";

              return (
                <div
                  key={match.id}
                  className={[
                    "bg-card border rounded-xl p-4",
                    yourTeam ? "border-primary/30" : "border-border",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {kickoffLabel}
                    </div>
                    <button
                      onClick={() => toggleNotify(match.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {notifyMap[match.id] ? (
                        <>
                          <Bell className="w-4 h-4 text-primary fill-primary" />
                          <span>On</span>
                        </>
                      ) : (
                        <>
                          <BellOff className="w-4 h-4" />
                          <span>Notify</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center overflow-hidden">
                        {resolveFlag(match.t1) ? (
                          <img
                            src={resolveFlag(match.t1)}
                            alt={resolveName(match.t1)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t1Code}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-foreground">{t1Code}</span>
                    </div>
                    <span className="text-muted-foreground">vs</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">{t2Code}</span>
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center overflow-hidden">
                        {resolveFlag(match.t2) ? (
                          <img
                            src={resolveFlag(match.t2)}
                            alt={resolveName(match.t2)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t2Code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {yourTeam && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                        Your team playing
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No upcoming matches in this stage</p>
              <p className="text-sm mt-1">
                Upcoming fixtures will appear here
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "results" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground/70">
              Loading matches...
            </div>
          ) : finishedMatches.length > 0 ? (
            finishedMatches.map((match) => {
              const yourTeam =
                isUserTeam(match.t1) || isUserTeam(match.t2);
              const t1Code =
                match.t1?.substring(0, 3).toUpperCase() || "TBD";
              const t2Code =
                match.t2?.substring(0, 3).toUpperCase() || "TBD";

              return (
                <div
                  key={match.id}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">
                      Final
                    </span>
                    {yourTeam && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                        Your team played
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center overflow-hidden">
                        {resolveFlag(match.t1) ? (
                          <img
                            src={resolveFlag(match.t1)}
                            alt={resolveName(match.t1)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t1Code}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-foreground">{t1Code}</span>
                    </div>
                    <div className="flex items-center gap-2 text-2xl font-bold text-foreground">
                      <span>{match.s1 ?? "-"}</span>
                      <span className="text-muted-foreground">-</span>
                      <span>{match.s2 ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">{t2Code}</span>
                      <div className="w-10 h-10 rounded-full bg-white/5 border border-border flex items-center justify-center overflow-hidden">
                        {resolveFlag(match.t2) ? (
                          <img
                            src={resolveFlag(match.t2)}
                            alt={resolveName(match.t2)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t2Code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No completed matches yet</p>
              <p className="text-sm mt-1">
                Results will appear here after matches finish
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardBracket;
