"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, X } from "lucide-react";
import { TierPill } from "@/components/tier/TierPill";
import { cn } from "@/lib/utils";

export type LBUser = {
  id: string;
  rank: number;
  name: string;
  totalScore: number;
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

const OVERALL_PAGE_SIZE = 10;

const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded bg-[var(--ff-hairline-muted)] ${className}`} />
);

function lastTwoWords(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length <= 2) return name.trim();
  return w.slice(-2).join(" ");
}

function nameInitials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  const s = w.map((p) => (p[0] ?? "")).join("").toUpperCase();
  return s.slice(0, 2) || "?";
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
  modeLabel = "Leaderboard",
}: LeaderboardPanelProps) {
  const [selectedUser, setSelectedUser] = useState<LBUser | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [podiumIn, setPodiumIn] = useState(false);
  const [rowVisible, setRowVisible] = useState<Record<number, boolean>>({});

  const [squad, setSquad] = useState<SquadVM | null>(null);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [squadErr, setSquadErr] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isLoading) {
      setPodiumIn(false);
      return;
    }
    const delay = prefersReducedMotion ? 0 : 80;
    const id = window.setTimeout(() => setPodiumIn(true), delay);
    return () => window.clearTimeout(id);
  }, [isLoading, prefersReducedMotion, data.length]);

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

  const visibleRows = useMemo(() => {
    return sorted;
  }, [sorted]);

  const rankedRows = useMemo(() => {
    const rows = [...visibleRows];
    rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    return rows.map((row, index) => ({ ...row, viewRank: index + 1 }));
  }, [visibleRows]);

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

  const pagedRowKey = useMemo(
    () => pagedList.map((u) => u.id).join("|"),
    [pagedList]
  );

  useEffect(() => {
    if (isLoading) {
      setRowVisible({});
      return;
    }
    if (prefersReducedMotion) {
      const all: Record<number, boolean> = {};
      pagedList.forEach((_, i) => {
        all[i] = true;
      });
      setRowVisible(all);
      return;
    }
    setRowVisible({});
    const timers = pagedList.map((_, i) =>
      window.setTimeout(() => {
        setRowVisible((prev) => ({ ...prev, [i]: true }));
      }, i * 38)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [isLoading, prefersReducedMotion, pagedRowKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const currentUserRow = useMemo(() => {
    if (!currentUserId) return null;
    return rankedRows.find((u) => u.id === currentUserId) ?? null;
  }, [currentUserId, rankedRows]);
  const youOnPodium = Boolean(
    currentUserRow && topIds.has(currentUserRow.id)
  );

  // Rank movement — compare current rank with last stored rank
  const rankDelta = useMemo(() => {
    if (typeof window === "undefined" || !currentUserId || !currentUserRow) return null;
    const key = `lb:rank:${currentUserId}`;
    const raw = window.localStorage.getItem(key);
    const prev = raw ? Number(raw) : NaN;
    if (!Number.isFinite(prev)) return null;
    return prev - currentUserRow.viewRank; // positive = moved up, negative = moved down
  }, [currentUserId, currentUserRow]);

  useEffect(() => {
    if (typeof window === "undefined" || !currentUserId || !currentUserRow) return;
    window.localStorage.setItem(`lb:rank:${currentUserId}`, String(currentUserRow.viewRank));
  }, [currentUserId, currentUserRow]);

  return (
    <main className="relative min-h-[500px] max-w-full overflow-x-hidden">
      <span className="sr-only">{modeLabel}</span>

      {isLoading ? (
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label="Loading leaderboard"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
            <div className="order-2 grid min-h-[140px] flex-1 grid-cols-3 gap-0 lg:order-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-2 py-4">
                  <Skeleton className="h-12 w-12 rounded-full sm:h-14 sm:w-14" />
                  <Skeleton className="h-4 w-16 sm:w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
            <div className="order-1 h-[104px] w-full shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 lg:order-2 lg:h-auto lg:min-h-[88px] lg:w-[min(100%,240px)]" />
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
            <div
              className={cn(
                "order-2 min-w-0 flex-1 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none lg:order-1",
                podiumIn ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              )}
            >
              <div
                className="grid grid-cols-[1fr_1.2fr_1fr] gap-0"
                role="list"
                aria-label="Top 3 leaderboard"
              >
            {(
              [
                { pos: 1 as const, entry: topThree[1] },
                { pos: 0 as const, entry: topThree[0] },
                { pos: 2 as const, entry: topThree[2] },
              ] as const
            ).map(({ pos, entry }, i) => {
              const colors = ["#f59e0b", "#9ca3af", "#b87333"] as const;
              const color = colors[pos];
              const isFirst = pos === 0;
              const bigScore = entry
                ? Number(entry.totalScore ?? 0).toLocaleString()
                : "—";
              const label = "PTS";
              const isYouPodium =
                Boolean(entry && currentUserId && entry.id === currentUserId);
              const shortName = entry
                ? `${lastTwoWords(entry.name || "—")}${isYouPodium ? " ← you" : ""}`
                : "—";
              const category = "";

              return (
                <div
                  key={i}
                  className={cn(
                    "relative text-center outline-none transition-colors motion-reduce:transition-none",
                    entry ? "cursor-pointer hover:bg-white/[0.02]" : "cursor-default",
                    isFirst ? "px-3 pb-4 pt-5" : "px-3 pb-4 pt-3.5"
                  )}
                  style={{ borderBottom: `2px solid ${color}` }}
                  role="button"
                  tabIndex={entry ? 0 : -1}
                  onClick={() => entry && openDrawerFor(entry)}
                  onKeyDown={(e) => {
                    if (!entry) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDrawerFor(entry);
                    }
                  }}
                >
                  <span
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none font-ff-display leading-none"
                    style={{
                      fontSize: isFirst ? 100 : 72,
                      fontWeight: 900,
                      color,
                      opacity: 0.06,
                    }}
                    aria-hidden
                  >
                    {pos + 1}
                  </span>
                  <div className="relative z-[1]">
                    <div
                      className="font-ff-display leading-none tracking-tight"
                      style={{
                        fontSize: isFirst ? 38 : 28,
                        fontWeight: 800,
                        color,
                        marginBottom: 4,
                      }}
                    >
                      {bigScore}
                    </div>
                    <div className="mb-1.5 font-ff-ui text-[9px] font-medium uppercase tracking-[0.1em] text-[var(--ff-fg-quieter-alt)]">
                      {label}
                    </div>
                    <div
                      className={cn(
                        "font-ff-ui font-semibold leading-tight text-[var(--ff-fg-tertiary)]",
                        isFirst ? "text-xs" : "text-[11px]"
                      )}
                    >
                      {shortName}
                    </div>
                    {category ? (
                      <div className="mt-0.5 font-ff-ui text-[9px] text-[var(--ff-fg-quieter-alt)]">
                        {category}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
              </div>
            </div>

            {currentUserId ? (
              <button
                type="button"
                onClick={() => currentUserRow && openDrawerFor(currentUserRow)}
                disabled={!currentUserRow}
                className={cn(
                  "order-1 flex w-full min-h-[44px] shrink-0 flex-col justify-center gap-2 rounded-xl border border-zinc-600 bg-zinc-950 p-3 text-left font-ff-ui text-zinc-50 outline-none transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 lg:order-2 lg:w-[min(100%,240px)]",
                  podiumIn ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                  !currentUserRow && "cursor-default opacity-70",
                  currentUserRow && youOnPodium
                    ? currentUserRow.viewRank === 1
                      ? "border-l-[3px] border-l-amber-400"
                      : currentUserRow.viewRank === 2
                        ? "border-l-[3px] border-l-zinc-300"
                        : "border-l-[3px] border-l-orange-400"
                    : "border-l-[3px] border-l-emerald-400"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
                      {currentUserRow
                        ? youOnPodium
                          ? "On the podium"
                          : "Your position"
                        : "Not yet ranked"}
                    </p>
                    <p className="mt-0.5 font-ff-display text-3xl font-bold leading-none tracking-tight text-white">
                      {currentUserRow ? `#${currentUserRow.viewRank}` : "—"}
                    </p>
                  </div>
                  {/* Rank movement indicator — replaces initials avatar */}
                  {currentUserRow && (
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border",
                        rankDelta === null || rankDelta === 0
                          ? "border-zinc-600 bg-zinc-900"
                          : rankDelta > 0
                            ? "border-emerald-500/60 bg-emerald-950"
                            : "border-red-500/60 bg-red-950"
                      )}
                      aria-label={
                        rankDelta === null || rankDelta === 0
                          ? "No change"
                          : rankDelta > 0
                            ? `Up ${rankDelta} place${rankDelta !== 1 ? "s" : ""}`
                            : `Down ${Math.abs(rankDelta)} place${Math.abs(rankDelta) !== 1 ? "s" : ""}`
                      }
                    >
                      {rankDelta === null || rankDelta === 0 ? (
                        <span className="font-ff-ui text-[11px] font-bold text-zinc-500">—</span>
                      ) : rankDelta > 0 ? (
                        <>
                          <span className="text-[10px] leading-none text-emerald-400">▲</span>
                          <span className="font-ff-ui text-[9px] font-bold leading-none text-emerald-400">{rankDelta}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] leading-none text-red-400">▼</span>
                          <span className="font-ff-ui text-[9px] font-bold leading-none text-red-400">{Math.abs(rankDelta)}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {currentUserRow ? (
                  <div className="flex items-center justify-between gap-2 border-t border-zinc-700 pt-2">
                    <p className="text-[11px] leading-snug text-zinc-400">
                      Tap to view squad
                    </p>
                    <p className="shrink-0 font-ff-display text-lg font-bold tabular-nums leading-none text-white">
                      {Number(currentUserRow.totalScore ?? 0).toLocaleString()}
                      <span className="ml-1 font-ff-ui text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                        pts
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] leading-snug text-zinc-500">
                    Scores update once matches begin
                  </p>
                )}
              </button>
            ) : null}
          </div>


          <div className="flex flex-col">
            {filteredList.length > 0
              ? pagedList.map((user, index) => {
                  const visible = Boolean(rowVisible[index]);
                  const isYou = Boolean(currentUserId && user.id === currentUserId);
                  const points = Number(user.totalScore ?? 0).toLocaleString();
                  return (
                    <div
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDrawerFor(user)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDrawerFor(user);
                        }
                      }}
                      className={cn(
                        "grid cursor-pointer grid-cols-[32px_36px_1fr_auto] items-center gap-2.5 border-b border-[rgba(255,255,255,0.04)] py-2.5 pl-2.5 font-ff-ui outline-none transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--ff-accent-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ff-bg-app)]",
                        visible ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
                        isYou
                          ? "mb-px rounded-r-lg border-l-[3px] border-l-[var(--ff-accent-text)] bg-[var(--ff-accent-dim)]"
                          : "border-l-[3px] border-l-transparent"
                      )}
                    >
                      <div
                        className={cn(
                          "text-center font-ff-display text-base font-bold leading-none",
                          isYou ? "text-[var(--ff-accent-text)]" : "text-[var(--ff-fg-faint)]"
                        )}
                      >
                        {user.viewRank}
                      </div>
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-ff-ui text-[10px] font-bold",
                          isYou
                            ? "border border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] text-[var(--ff-accent-text)]"
                            : "bg-[#161b24] text-[var(--ff-fg-quieter)]"
                        )}
                        aria-hidden
                      >
                        {nameInitials(user.name)}
                      </div>
                      <div className="min-w-0 text-left">
                        <div
                          className={cn(
                            "truncate font-ff-ui text-[13px] text-[var(--ff-fg-muted)]",
                            isYou ? "font-semibold text-[var(--ff-accent-text)]" : "font-normal"
                          )}
                        >
                          {user.name}
                          {isYou ? (
                            <span className="font-medium text-[var(--ff-accent-text)]"> ← you</span>
                          ) : null}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "pr-1 text-right font-ff-display text-xl font-bold leading-none tracking-tight",
                          isYou ? "text-[var(--ff-accent-text)]" : "text-[var(--ff-fg-secondary)]"
                        )}
                      >
                        {points}
                      </div>
                    </div>
                  );
                })
              : visibleRows.length > 0 ? null : (
                  <div className="rounded-xl border border-[var(--ff-hairline)] bg-[var(--ff-bg-card)] p-5 font-ff-ui text-sm text-[var(--ff-fg-quiet)]">
                    No participants to display.
                  </div>
                )}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-[var(--ff-hairline)] bg-[var(--ff-bg-card)] px-3 py-2 font-ff-ui">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="min-h-[40px] rounded-md border border-[var(--ff-hairline)] px-3 py-2 text-sm font-semibold text-[var(--ff-fg-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <p className="text-xs text-[var(--ff-fg-quiet)] sm:text-sm">
                Page {currentPage} of {totalPages}
              </p>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage >= totalPages}
                className="min-h-[40px] rounded-md border border-[var(--ff-hairline)] px-3 py-2 text-sm font-semibold text-[var(--ff-fg-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      )}

      {selectedUser && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setSelectedUser(null);
              setSquad(null);
              setSquadErr("");
              setLoadingSquad(false);
            }}
          />
          <div
            className={[
              "fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-[var(--ff-hairline)] bg-[var(--ff-bg-app)] md:w-[520px]",
              "animate-in slide-in-from-right duration-500",
              "shadow-[0_30px_80px_rgba(0,0,0,0.35)]",
              "pt-safe pb-safe",
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
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {squadTeams.length > 0 ? (
                    squadTeams.filter((team) => !String(team.id ?? "").startsWith("PO_")).map((team) => {
                      const isStarTeam = team.role === "featured";
                      const tier = Number(team.tier ?? 0) || 4;
                      const teamId = String(team.id ?? "-");
                      const flagUrl = String(team.flagUrl ?? "");
                      const points = Number(team.contribution ?? 0);
                      const initials = teamId.slice(0, 3).toUpperCase();

                      const tierLabel =
                        tier === 1 ? "Elite" :
                        tier === 2 ? "Strong" :
                        tier === 3 ? "Competitive" :
                        "Underdog";

                      const tierChipColors =
                        tier === 1
                          ? "bg-amber-400/25 text-amber-200 border-amber-400/50"
                          : tier === 2
                            ? "bg-slate-300/20 text-slate-200 border-slate-300/50"
                            : tier === 3
                              ? "bg-orange-500/20 text-orange-200 border-orange-400/50"
                              : "bg-zinc-500/20 text-zinc-300 border-zinc-400/40";

                      return (
                        <div
                          key={`${team.role}:${teamId}`}
                          className={[
                            "relative overflow-hidden rounded-xl border border-white/10",
                            "aspect-[4/3]",
                            "shadow-[0_8px_20px_rgba(0,0,0,0.28)]",
                            isStarTeam ? "ring-1 ring-orange-400/50" : "",
                          ].join(" ")}
                        >
                          {/* Flag — full-bleed background */}
                          {flagUrl ? (
                            <img
                              src={flagUrl}
                              alt={team.name}
                              className="absolute inset-0 w-full h-full object-cover opacity-60"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-white/5 flex items-center justify-center">
                              <span className="text-xl font-black text-white/15 tracking-tight">{initials}</span>
                            </div>
                          )}

                          {/* Deep gradient — covers bottom 65% so score dominates */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />

                          {/* Star team badge — top left, compact */}
                          {isStarTeam && (
                            <div className="absolute top-1.5 left-1.5 z-20">
                              <div className="bg-orange-500 border border-orange-300/60 text-zinc-950 text-[8px] font-black px-2 py-[2px] rounded-full flex items-center gap-1 shadow-md whitespace-nowrap">
                                <Crown size={8} className="fill-current shrink-0" aria-hidden="true" />
                                Star · 2x
                              </div>
                            </div>
                          )}

                          {/* Bottom content */}
                          <div className="absolute bottom-0 inset-x-0 z-10 px-2.5 pb-2 pt-1">
                            {/* Name + tier on one line */}
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-bold text-[12px] text-white leading-none truncate">
                                {team.name}
                              </span>
                              <span className={[
                                "shrink-0 rounded border px-1 py-px text-[8px] font-bold leading-tight whitespace-nowrap",
                                tierChipColors,
                              ].join(" ")}>
                                T{tier}
                              </span>
                            </div>

                            {/* Points — big */}
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-[8px] uppercase tracking-wider text-white/65 font-semibold">pts</span>
                              <span className="text-4xl font-black text-white leading-none tabular-nums tracking-tight">
                                {points}
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
