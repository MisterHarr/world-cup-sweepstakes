"use client";

import { useMemo, useState } from "react";
import { Crown, Shield, Trophy, X } from "lucide-react";

export type LBUser = {
  id: string;
  rank: number;
  name: string;
  totalScore: number;
  department?: string | null;
  dept?: string | null;
  teams?: Array<{
    name: string;
    points: number;
    status?: string;
    isCaptain?: boolean;
  }>;
};

export type SquadTeamVM = {
  id: string;
  name: string;
  group?: string;
  tier?: number;
  flagUrl?: string;
  role: "featured" | "drawn";
  contribution: number;
};

export type SquadVM = {
  userId: string;
  displayName: string;
  totalScore: number;
  featured: SquadTeamVM | null;
  drawn: SquadTeamVM[];
};

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-white/10 rounded ${className}`} />
);

function tierLabel(tier: number) {
  if (tier === 1) return "Elite";
  if (tier === 2) return "Strong";
  if (tier === 3) return "Competitive";
  return "Underdog";
}

function tierPillClass(tier: number) {
  if (tier === 1) {
    return "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-200 border-yellow-500/40 shadow-sm shadow-yellow-500/20";
  }
  if (tier === 2) {
    return "bg-gradient-to-r from-slate-400/20 to-gray-300/20 text-slate-100 border-slate-400/40 shadow-sm shadow-slate-400/20";
  }
  if (tier === 3) {
    return "bg-gradient-to-r from-orange-600/20 to-amber-700/20 text-orange-200 border-orange-600/40 shadow-sm shadow-orange-600/20";
  }
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

type LeaderboardPanelProps = {
  data?: LBUser[];
  isLoading?: boolean;
  fetchSquad: (userId: string, displayNameFallback: string) => Promise<SquadVM>;
  currentUserId?: string | null;
};

export default function LeaderboardPanel({
  data = [],
  isLoading = false,
  fetchSquad,
  currentUserId,
}: LeaderboardPanelProps) {
  const [selectedUser, setSelectedUser] = useState<LBUser | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  const [squad, setSquad] = useState<SquadVM | null>(null);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [squadErr, setSquadErr] = useState<string>("");

  async function openDrawerFor(user: LBUser) {
    setSelectedUser(user);
    setSquad(null);
    setSquadErr("");
    setLoadingSquad(true);

    try {
      const vm = await fetchSquad(user.id, user.name);
      setSquad(vm);
    } catch (err: any) {
      console.error(err);
      setSquadErr(err?.message ?? "Failed to load squad details.");
    } finally {
      setLoadingSquad(false);
    }
  }

  const squadTeams: SquadTeamVM[] = useMemo(() => {
    if (!squad) return [];
    const out: SquadTeamVM[] = [];
    if (squad.featured) out.push(squad.featured);
    out.push(...(squad.drawn ?? []));
    return out;
  }, [squad]);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }, [data]);

  const topThree = useMemo(() => sorted.slice(0, 3), [sorted]);
  const topIds = useMemo(() => new Set(topThree.map((u) => u.id)), [topThree]);
  const hasDeptData = useMemo(
    () => sorted.some((u) => Boolean(u.department ?? u.dept)),
    [sorted]
  );
  const deptFromData = useMemo(() => {
    const set = new Set<string>();
    sorted.forEach((u) => {
      const dept = u.department ?? u.dept;
      if (dept) set.add(String(dept));
    });
    return Array.from(set);
  }, [sorted]);
  const deptFilters = deptFromData.length
    ? deptFromData
    : ["Primary", "Secondary", "Admin"];

  const filteredList = useMemo(() => {
    const source =
      hasDeptData && selectedDept
        ? sorted.filter((u) => (u.department ?? u.dept) === selectedDept)
        : sorted;
    return source.filter((u) => !topIds.has(u.id));
  }, [hasDeptData, selectedDept, sorted, topIds]);

  return (
    <main className="relative min-h-[500px] max-w-full overflow-x-hidden">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 px-2 sm:px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Leaderboard</h1>
            <p className="text-xs text-muted-foreground">
              {sorted.length} Participants
            </p>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-200">
          Standalone
        </div>
        <div
          className="text-emerald-300 text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          LIVE
        </div>
      </div>

      {isLoading ? (
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label="Loading leaderboard"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-11 w-24 rounded-full" />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-border bg-card/70"
              >
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <ol
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 px-2 sm:px-4 list-none"
            aria-label="Top 3 leaderboard"
          >
            <li
              className="flex flex-col items-center order-2 cursor-pointer hover:scale-105 transition-transform"
              value={1}
              onClick={() => topThree[0] && openDrawerFor(topThree[0])}
            >
              <div className="relative mb-3">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-300 flex items-center justify-center shadow-xl ring-4 ring-yellow-500/30">
                  <span className="text-4xl font-bold text-amber-900">1</span>
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Crown
                    className="w-8 h-8 text-yellow-500 drop-shadow-lg"
                    aria-hidden="true"
                  />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                  <Trophy className="w-3 h-3 text-amber-900" aria-hidden="true" />
                </div>
              </div>
              <p className="text-base font-bold text-foreground text-center line-clamp-1">
                {topThree[0]?.name ?? "-"}
              </p>
              <p className="text-sm text-primary font-bold mt-1">
                {Number(topThree[0]?.totalScore ?? 0).toLocaleString()} pts
              </p>
            </li>

            <li
              className="flex flex-col items-center pt-8 order-1 cursor-pointer hover:scale-105 transition-transform"
              value={2}
              onClick={() => topThree[1] && openDrawerFor(topThree[1])}
            >
              <div className="relative mb-3">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-400 to-slate-200 flex items-center justify-center shadow-lg ring-4 ring-slate-400/20">
                  <span className="text-3xl font-bold text-slate-800">2</span>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" aria-hidden="true" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground text-center line-clamp-1">
                {topThree[1]?.name ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                {Number(topThree[1]?.totalScore ?? 0).toLocaleString()} pts
              </p>
            </li>

            <li
              className="flex flex-col items-center pt-12 order-3 cursor-pointer hover:scale-105 transition-transform"
              value={3}
              onClick={() => topThree[2] && openDrawerFor(topThree[2])}
            >
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-600 to-amber-700 flex items-center justify-center shadow-lg ring-4 ring-orange-600/20">
                  <span className="text-2xl font-bold text-amber-100">3</span>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" aria-hidden="true" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground text-center line-clamp-1">
                {topThree[2]?.name ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                {Number(topThree[2]?.totalScore ?? 0).toLocaleString()} pts
              </p>
            </li>
          </ol>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-6">
            <button
              onClick={() => setSelectedDept(null)}
              className={[
                "shrink-0 rounded-lg px-4 py-3 text-sm font-semibold transition-all min-h-[44px]",
                selectedDept === null
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
              ].join(" ")}
            >
              Overall
            </button>
            {deptFilters.slice(0, 2).map((dept) => (
              <button
                key={dept}
                onClick={() =>
                  setSelectedDept((prev) => (prev === dept ? null : dept))
                }
                className={[
                  "shrink-0 rounded-lg px-4 py-3 text-sm font-semibold transition-all min-h-[44px]",
                  selectedDept === dept
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                ].join(" ")}
              >
                By {dept}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredList.length > 0
              ? filteredList.map((user) => {
                  const isYou = Boolean(currentUserId && user.id === currentUserId);
                  const dept = user.department ?? user.dept;
                  return (
                    <div
                      key={user.id}
                      onClick={() => openDrawerFor(user)}
                      className={[
                        "flex items-center gap-4 p-4 bg-card border border-border rounded-xl transition-all cursor-pointer hover:bg-card/80 min-h-[60px]",
                        isYou
                          ? "border-primary/60 ring-2 ring-primary/30 bg-gradient-to-r from-primary/15 to-primary/5"
                          : "hover:border-primary/20",
                      ].join(" ")}
                    >
                      <div className="w-8 text-center">
                        <span
                          className={[
                            "text-lg font-bold",
                            isYou ? "text-primary" : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {user.rank}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "font-medium",
                              isYou ? "text-primary" : "text-foreground",
                            ].join(" ")}
                          >
                            {user.name}
                          </span>
                          {isYou && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                              You
                            </span>
                          )}
                        </div>
                        {dept ? (
                          <p className="text-xs text-muted-foreground">{dept}</p>
                        ) : null}
                      </div>

                      <div className="text-right w-16">
                        <span className="text-lg font-bold text-foreground">
                          {Number(user.totalScore ?? 0).toLocaleString()}
                        </span>
                        <p className="text-[10px] text-muted-foreground">pts</p>
                      </div>
                    </div>
                  );
                })
              : [...Array(6)].map((_, i) => (
                  <div
                    key={`placeholder-row-${i}`}
                    className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl"
                  >
                    <div className="w-8 text-center">
                      <span className="text-lg font-bold text-muted-foreground/60">
                        {i + 4}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                      <div className="h-3 w-24 bg-white/5 rounded animate-pulse mt-2" />
                    </div>
                    <div className="text-right w-16">
                      <div className="h-4 w-12 bg-white/10 rounded animate-pulse ml-auto" />
                      <p className="text-[10px] text-muted-foreground/70 mt-1">pts</p>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      )}

      {selectedUser && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => {
              setSelectedUser(null);
              setSquad(null);
              setSquadErr("");
              setLoadingSquad(false);
            }}
          />
          <div
            className={[
              "fixed inset-y-0 right-0 w-full md:w-[520px] bg-card/70 z-50 overflow-y-auto",
              "animate-in slide-in-from-right duration-500",
              "shadow-[0_30px_80px_rgba(0,0,0,0.35)]",
              "pb-safe",
            ].join(" ")}
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="text-muted-foreground/70 text-xs font-bold uppercase tracking-widest mb-2">
                    Squad Details
                  </div>
                  <h3 className="text-3xl font-bold text-foreground tracking-tight">
                    {selectedUser.name}
                  </h3>

                  <div className="mt-2 flex items-center gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                      Total Score
                    </div>
                    <div className="font-mono font-bold text-foreground">
                      {Number(squad?.totalScore ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setSquad(null);
                    setSquadErr("");
                    setLoadingSquad(false);
                  }}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-muted-foreground/80 hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {squadErr && (
                <div className="mb-4 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
                  {squadErr}
                </div>
              )}

              {loadingSquad && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl bg-card/70 border border-border shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                    >
                      <Skeleton className="h-6 w-24" />
                      <div className="mt-3 flex items-center gap-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20 mt-2" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20 mt-4" />
                    </div>
                  ))}
                </div>
              )}

              {!loadingSquad && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {squadTeams.length > 0 ? (
                    squadTeams.map((team) => {
                      const isCaptain = team.role === "featured";
                      const tier = Number(team.tier ?? 0);
                      const group = String(team.group ?? "-");
                      const teamId = String(team.id ?? "-");
                      const flagUrl = String(team.flagUrl ?? "");

                      return (
                        <div
                          key={`${team.role}:${teamId}`}
                          className={[
                            "relative p-5 rounded-2xl flex flex-col justify-between min-h-[180px]",
                            "bg-card/70 border border-border",
                            "shadow-[0_12px_30px_rgba(0,0,0,0.10)]",
                          ].join(" ")}
                        >
                          {isCaptain && (
                            <div className="absolute -top-3 -right-2 bg-orange-500/15 border border-orange-500/30 text-orange-200 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm z-10">
                              <Crown size={12} className="fill-current" aria-hidden="true" />
                              CAPTAIN 2x
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-lg text-foreground tracking-tight truncate">
                                {team.name}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground/80">
                                Team ID{" "}
                                <span className="font-mono text-foreground/90">
                                  {teamId}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground/80">
                                Group{" "}
                                <span className="font-semibold text-foreground/90">
                                  {group}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <div className="w-12 h-12 rounded-full overflow-hidden border border-border bg-white/5 flex items-center justify-center shadow-inner">
                                {flagUrl ? (
                                  <img
                                    src={flagUrl}
                                    alt={team.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/70">
                                    -
                                  </span>
                                )}
                              </div>

                              <TierPill tier={tier || 4} />
                            </div>
                          </div>

                          <div className="mt-5">
                            <div className="text-xs text-muted-foreground/70 font-semibold uppercase tracking-wider mb-1">
                              Contribution
                            </div>
                            <div className="text-2xl font-mono text-foreground font-medium">
                              {Number(team.contribution ?? 0)}{" "}
                              <span className="text-xs text-emerald-300 font-bold">
                                pts
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 text-center text-muted-foreground/70 py-12 italic border-2 border-dashed border-border rounded-2xl bg-white/5">
                      No teams drafted yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
