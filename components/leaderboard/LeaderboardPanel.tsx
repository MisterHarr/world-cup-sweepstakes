"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Shield, Trophy, X } from "lucide-react";
import {
  fromDepartmentKey,
  normalizeDepartment,
  toDepartmentKey,
  type DepartmentKey,
} from "@/lib/departments";

export type LBUser = {
  id: string;
  rank: number;
  name: string;
  totalScore: number;
  badgeCount?: number;
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

const CORE_DEPARTMENT_TABS = ["Primary", "Secondary", "Admin"] as const;
const OVERALL_PAGE_SIZE = 10;

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
    return "bg-gradient-to-br from-amber-400/20 to-yellow-500/10 text-amber-100 border-amber-400/45 shadow-[0_8px_18px_rgba(251,191,36,0.28)]";
  }
  if (tier === 2) {
    return "bg-gradient-to-br from-slate-300/20 to-zinc-300/10 text-slate-100 border-slate-300/45 shadow-[0_8px_18px_rgba(203,213,225,0.18)]";
  }
  if (tier === 3) {
    return "bg-gradient-to-br from-orange-500/18 to-amber-600/12 text-orange-100 border-orange-500/45 shadow-[0_8px_18px_rgba(249,115,22,0.20)]";
  }
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

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const raw =
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  if (!raw) return fallback;
  return raw.replace(/^FirebaseError:\s*/i, "").trim() || fallback;
}

type LeaderboardPanelProps = {
  data?: LBUser[];
  isLoading?: boolean;
  fetchSquad: (userId: string, displayNameFallback: string) => Promise<SquadVM>;
  currentUserId?: string | null;
  modeLabel?: string;
};

export default function LeaderboardPanel({
  data = [],
  isLoading = false,
  fetchSquad,
  currentUserId,
  modeLabel = "Standalone",
}: LeaderboardPanelProps) {
  const [selectedUser, setSelectedUser] = useState<LBUser | null>(null);
  const [selectedDept, setSelectedDept] = useState<DepartmentKey | null>(null);
  const [sortMode, setSortMode] = useState<"points" | "badges">("points");
  const [currentPage, setCurrentPage] = useState(1);

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
    } catch (err: unknown) {
      console.error(err);
      setSquadErr(friendlyErrorMessage(err, "Failed to load squad details."));
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

  const hasDeptData = useMemo(
    () => sorted.some((u) => Boolean(toDepartmentKey(u.department ?? u.dept))),
    [sorted]
  );
  const deptFilters = CORE_DEPARTMENT_TABS;

  const visibleRows = useMemo(() => {
    return selectedDept && hasDeptData
      ? sorted.filter(
          (u) => toDepartmentKey(u.department ?? u.dept) === selectedDept
        )
      : sorted;
  }, [hasDeptData, selectedDept, sorted]);

  const rankedRows = useMemo(() => {
    const rows = [...visibleRows];
    if (sortMode === "badges") {
      rows.sort((a, b) => {
        const badgeDelta = Number(b.badgeCount ?? 0) - Number(a.badgeCount ?? 0);
        if (badgeDelta !== 0) return badgeDelta;
        const scoreDelta = Number(b.totalScore ?? 0) - Number(a.totalScore ?? 0);
        if (scoreDelta !== 0) return scoreDelta;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });
    } else {
      rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    }
    return rows.map((row, index) => ({ ...row, viewRank: index + 1 }));
  }, [sortMode, visibleRows]);

  const topThree = useMemo(() => rankedRows.slice(0, 3), [rankedRows]);
  const topIds = useMemo(() => new Set(topThree.map((u) => u.id)), [topThree]);
  const filteredList = useMemo(
    () => rankedRows.filter((u) => !topIds.has(u.id)),
    [rankedRows, topIds]
  );
  const totalPages = useMemo(() => {
    if (rankedRows.length === 0) return 1;
    return Math.max(1, Math.ceil(rankedRows.length / OVERALL_PAGE_SIZE));
  }, [rankedRows.length]);
  const pagedList = useMemo(() => {
    const pageStartRank = (currentPage - 1) * OVERALL_PAGE_SIZE + 1;
    const pageEndRank = currentPage * OVERALL_PAGE_SIZE;
    const minListRank = Math.max(4, pageStartRank);
    return rankedRows.filter(
      (user) => user.viewRank >= minListRank && user.viewRank <= pageEndRank
    );
  }, [currentPage, rankedRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDept, sortMode]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const currentUserRow = useMemo(() => {
    if (!currentUserId) return null;
    return rankedRows.find((u) => u.id === currentUserId) ?? null;
  }, [currentUserId, rankedRows]);
  const showPinnedYou = Boolean(currentUserRow && !topIds.has(currentUserRow.id));

  return (
    <main className="relative min-h-[500px] max-w-full overflow-x-hidden">
      <span className="sr-only">{modeLabel}</span>

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
            className="grid grid-cols-3 gap-2 sm:gap-4 mb-8 px-1 sm:px-4 list-none"
            aria-label="Top 3 leaderboard"
          >
            <li
              className="flex flex-col items-center order-2 cursor-pointer hover:scale-105 transition-transform"
              value={1}
              onClick={() => topThree[0] && openDrawerFor(topThree[0])}
            >
              <div className="relative mb-3">
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-300 flex items-center justify-center shadow-xl ring-4 ring-yellow-500/30">
                  <span className="text-2xl sm:text-4xl font-bold text-amber-900">1</span>
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Crown
                    className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 drop-shadow-lg"
                    aria-hidden="true"
                  />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                  <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-900" aria-hidden="true" />
                </div>
              </div>
              <p className="text-xs sm:text-base font-bold text-foreground text-center line-clamp-1">
                {currentUserId && topThree[0]?.id === currentUserId
                  ? "You"
                  : (topThree[0]?.name ?? "-")}
              </p>
              <p className="text-[11px] sm:text-sm text-primary font-bold mt-1">
                {sortMode === "badges"
                  ? `${Number(topThree[0]?.badgeCount ?? 0).toLocaleString()} badges`
                  : `${Number(topThree[0]?.totalScore ?? 0).toLocaleString()} pts`}
              </p>
            </li>

            <li
              className="flex flex-col items-center pt-4 sm:pt-8 order-1 cursor-pointer hover:scale-105 transition-transform"
              value={2}
              onClick={() => topThree[1] && openDrawerFor(topThree[1])}
            >
              <div className="relative mb-3">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-slate-400 to-slate-200 flex items-center justify-center shadow-lg ring-4 ring-slate-400/20">
                  <span className="text-xl sm:text-3xl font-bold text-slate-800">2</span>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-400 flex items-center justify-center">
                  <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" aria-hidden="true" />
                </div>
              </div>
              <p className="text-[11px] sm:text-sm font-semibold text-foreground text-center line-clamp-1">
                {currentUserId && topThree[1]?.id === currentUserId
                  ? "You"
                  : (topThree[1]?.name ?? "-")}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1">
                {sortMode === "badges"
                  ? `${Number(topThree[1]?.badgeCount ?? 0).toLocaleString()} badges`
                  : `${Number(topThree[1]?.totalScore ?? 0).toLocaleString()} pts`}
              </p>
            </li>

            <li
              className="flex flex-col items-center pt-6 sm:pt-12 order-3 cursor-pointer hover:scale-105 transition-transform"
              value={3}
              onClick={() => topThree[2] && openDrawerFor(topThree[2])}
            >
              <div className="relative mb-3">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-orange-600 to-amber-700 flex items-center justify-center shadow-lg ring-4 ring-orange-600/20">
                  <span className="text-lg sm:text-2xl font-bold text-amber-100">3</span>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-600 flex items-center justify-center">
                  <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" aria-hidden="true" />
                </div>
              </div>
              <p className="text-[11px] sm:text-sm font-semibold text-foreground text-center line-clamp-1">
                {currentUserId && topThree[2]?.id === currentUserId
                  ? "You"
                  : (topThree[2]?.name ?? "-")}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1">
                {sortMode === "badges"
                  ? `${Number(topThree[2]?.badgeCount ?? 0).toLocaleString()} badges`
                  : `${Number(topThree[2]?.totalScore ?? 0).toLocaleString()} pts`}
              </p>
            </li>
          </ol>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-6">
            <button
              onClick={() => {
                setSelectedDept(null);
                setSortMode("points");
              }}
              className={[
                "shrink-0 rounded-lg px-4 py-3 text-sm font-semibold transition-all min-h-[44px]",
                selectedDept === null && sortMode === "points"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
              ].join(" ")}
            >
              Overall
            </button>
            {deptFilters.map((dept) => (
              <button
                key={dept}
                onClick={() => {
                  setSortMode("points");
                  const deptKey = toDepartmentKey(dept);
                  if (!deptKey) {
                    setSelectedDept(null);
                    return;
                  }
                  setSelectedDept((prev) => (prev === deptKey ? null : deptKey));
                }}
                className={[
                  "shrink-0 rounded-lg px-4 py-3 text-sm font-semibold transition-all min-h-[44px]",
                  selectedDept === toDepartmentKey(dept) && sortMode === "points"
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                ].join(" ")}
              >
                By {dept}
              </button>
            ))}
            <button
              onClick={() => {
                setSortMode("badges");
                setSelectedDept(null);
              }}
              className={[
                "shrink-0 rounded-lg px-4 py-3 text-sm font-semibold transition-all min-h-[44px]",
                sortMode === "badges"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
              ].join(" ")}
            >
              Badges
            </button>
          </div>

          <div className="space-y-2">
            {filteredList.length > 0
              ? pagedList.map((user) => {
                  const isYou = Boolean(currentUserId && user.id === currentUserId);
                  const dept = normalizeDepartment(user.department ?? user.dept);
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
                          {user.viewRank}
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
                            {isYou ? "You" : user.name}
                          </span>
                        </div>
                        {dept ? (
                          <p className="text-xs text-muted-foreground">{dept}</p>
                        ) : null}
                      </div>

                      <div className="text-right w-16">
                        <span className="text-lg font-bold text-foreground">
                          {sortMode === "badges"
                            ? Number(user.badgeCount ?? 0).toLocaleString()
                            : Number(user.totalScore ?? 0).toLocaleString()}
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {sortMode === "badges" ? "badges" : "pts"}
                        </p>
                      </div>
                    </div>
                  );
                })
              : visibleRows.length > 0 ? null : (
                  <div className="p-5 rounded-xl border border-border bg-card text-sm text-muted-foreground">
                    {selectedDept && !hasDeptData
                      ? "Department splits are unavailable until leaderboard data includes departments."
                      : selectedDept
                        ? `No participants found in ${fromDepartmentKey(selectedDept)}.`
                        : "No participants to display."}
                  </div>
                )}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-card/70 px-3 py-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="min-h-[40px] rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </p>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage >= totalPages}
                className="min-h-[40px] rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}

          {showPinnedYou && currentUserRow ? (
            <div className="sticky bottom-3 z-20 mt-6">
              <button
                onClick={() => openDrawerFor(currentUserRow)}
                className="w-full rounded-xl border border-primary/40 bg-gradient-to-r from-primary/20 to-primary/10 px-4 py-3 flex items-center justify-between text-left"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-primary/90">
                    You
                  </p>
                  <p className="text-sm text-foreground font-semibold">
                    Rank #{currentUserRow.viewRank}
                  </p>
                </div>
                <p className="text-sm text-foreground font-bold">
                  {sortMode === "badges"
                    ? `${Number(currentUserRow.badgeCount ?? 0).toLocaleString()} badges`
                    : `${Number(currentUserRow.totalScore ?? 0).toLocaleString()} pts`}
                </p>
              </button>
            </div>
          ) : null}
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
              "fixed inset-y-0 right-0 w-full md:w-[520px] bg-gradient-to-br from-zinc-600 to-zinc-800 z-50 overflow-y-auto",
              "animate-in slide-in-from-right duration-500",
              "shadow-[0_30px_80px_rgba(0,0,0,0.35)]",
              "pb-safe",
            ].join(" ")}
          >
            <div className="p-4 sm:p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="text-muted-foreground/70 text-xs font-bold uppercase tracking-widest mb-2">
                    Squad Details
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
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
                <div className="grid grid-cols-2 gap-2 sm:gap-5">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="p-3 sm:p-5 rounded-2xl bg-card border border-border shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                    >
                      <Skeleton className="h-6 w-24" />
                      <div className="mt-3 flex items-center gap-2">
                        <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-3 sm:h-4 w-24 sm:w-32" />
                          <Skeleton className="h-3 w-20 mt-2" />
                        </div>
                      </div>
                      <Skeleton className="h-7 sm:h-8 w-16 sm:w-20 mt-3 sm:mt-4" />
                    </div>
                  ))}
                </div>
              )}

              {!loadingSquad && (
                <div className="grid grid-cols-2 gap-2 sm:gap-5">
                  {squadTeams.length > 0 ? (
                    squadTeams.map((team) => {
                      const isCaptain = team.role === "featured";
                      const tier = Number(team.tier ?? 0);
                      const teamId = String(team.id ?? "-");
                      const flagUrl = String(team.flagUrl ?? "");

                      return (
                        <div
                          key={`${team.role}:${teamId}`}
                          className={[
                            "relative p-3 sm:p-4 rounded-2xl min-h-[148px] sm:min-h-[186px]",
                            "bg-card border border-white/10",
                            "shadow-[0_12px_30px_rgba(0,0,0,0.10)] transition-colors",
                          ].join(" ")}
                        >
                          {isCaptain && (
                            <div className="absolute -top-3 -right-2 bg-orange-500 border border-orange-300 text-zinc-950 text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md z-10">
                              <Crown size={12} className="fill-current" aria-hidden="true" />
                              CAPTAIN 2x
                            </div>
                          )}

                          <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
                            <div className="min-w-0 flex flex-col items-start gap-2">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border border-white/15 bg-black/20 flex items-center justify-center">
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

                              <div className="min-w-0">
                                <div className="font-black text-sm sm:text-base text-foreground tracking-tight leading-tight line-clamp-2">
                                  {team.name}
                                </div>
                                <div className="mt-1 inline-flex rounded-md border border-white/15 bg-black/20 px-2 py-0.5 text-[10px] sm:text-xs font-mono text-foreground/90">
                                  {teamId}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <TierPill tier={tier || 4} />
                              <div className="rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-right min-w-[98px]">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                  Points
                                </div>
                                <div className="text-lg sm:text-xl font-black text-foreground leading-none mt-1">
                                  {Number(team.contribution ?? 0)}
                                </div>
                              </div>
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
