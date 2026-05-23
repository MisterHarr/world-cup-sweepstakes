"use client";

import { useEffect, useMemo, useState } from "react";
import {
  stageLabel,
  type BracketMatch,
  type BracketStage,
} from "@/lib/bracketUtils";
import { cn } from "@/lib/utils";

function filterMatchesForTab(
  rows: BracketMatch[],
  tab: "live" | "upcoming" | "results"
): BracketMatch[] {
  const norm = (status?: string) => (status || "").toUpperCase();
  const live = (m: BracketMatch) =>
    Boolean(m.isLive) || norm(m.status) === "LIVE";
  const fin = (m: BracketMatch) => {
    const s = norm(m.status);
    return s === "FINISHED" || s === "FINAL" || s === "FT";
  };
  if (tab === "live") return rows.filter(live);
  if (tab === "upcoming") return rows.filter((m) => !live(m) && !fin(m));
  return rows.filter(fin);
}

const DashboardBracket = ({
  stages = [],
  matches = {},
  isLoading = false,
  teamNames = {},
  teamFlags = {},
  userTeamIds = [],
  activeStageId,
  onStageChange,
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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [matchRowVisible, setMatchRowVisible] = useState<Record<number, boolean>>(
    {}
  );
  const [fixtureSearch, setFixtureSearch] = useState("");

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

  useEffect(() => {
    const stage = stagesToUse[safeStageIndex];
    if (!stage || !onStageChange) return;
    if (activeStageId && stage.id === activeStageId) return;
    onStageChange(stage.id);
  }, [activeStageId, onStageChange, safeStageIndex, stagesToUse]);

  // All matches across every stage — used for global fixture search
  const allMatches = useMemo(
    () => Object.values(matches).flat(),
    [matches]
  );

  const visibleMatches = useMemo(() => {
    // When searching upcoming fixtures, span the entire tournament (all stages)
    if (activeTab === "upcoming" && fixtureSearch.trim()) {
      const q = fixtureSearch.trim().toLowerCase();
      return filterMatchesForTab(allMatches, "upcoming").filter((m) => {
        const t1 = (teamNames[m.t1 ?? ""] ?? m.t1 ?? "").toLowerCase();
        const t2 = (teamNames[m.t2 ?? ""] ?? m.t2 ?? "").toLowerCase();
        const grp = (m.group ?? "").toLowerCase();
        const stage = (m.stageId ?? "").toLowerCase();
        return t1.includes(q) || t2.includes(q) || grp.includes(q) || stage.includes(q);
      });
    }
    return filterMatchesForTab(currentMatches, activeTab);
  }, [allMatches, currentMatches, activeTab, fixtureSearch, teamNames]);
  const visibleMatchIds = visibleMatches.map((m) => m.id).join(",");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const h = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (isLoading) {
      setMatchRowVisible({});
      return;
    }
    const rows = filterMatchesForTab(currentMatches, activeTab);
    if (prefersReducedMotion) {
      const all: Record<number, boolean> = {};
      rows.forEach((_, i) => {
        all[i] = true;
      });
      setMatchRowVisible(all);
      return;
    }
    setMatchRowVisible({});
    const timers = rows.map((_, i) =>
      window.setTimeout(() => {
        setMatchRowVisible((prev) => ({ ...prev, [i]: true }));
      }, i * 65)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [
    isLoading,
    prefersReducedMotion,
    activeTab,
    safeStageIndex,
    visibleMatchIds,
  ]);

  const stageTitle =
    activeStage?.name ?? stageLabel(activeStage?.id ?? "");

  const headerMid = (match: BracketMatch, tab: typeof activeTab) => {
    if (tab === "live") return "LIVE";
    if (tab === "results") return "FT";
    return match.kickoffTime ? formatKickoff(match.kickoffTime) : "Scheduled";
  };

  const matchCardEyebrow = (match: BracketMatch, tab: typeof activeTab) => {
    const mid = headerMid(match, tab);
    // When searching across stages, use the match's own stageId for the label
    const resolvedStageId = (fixtureSearch.trim() && match.stageId) ? match.stageId : (activeStage?.id ?? "");
    const resolvedStageTitle = stageLabel(resolvedStageId);
    if (resolvedStageId === "GROUP") {
      const g = match.group?.trim();
      return g ? `GROUP ${g.toUpperCase()} · ${mid}` : `GROUP · ${mid}`;
    }
    return `${resolvedStageTitle} · ${mid}`;
  };

  const renderFfMatchCard = (
    match: BracketMatch,
    index: number,
    tab: typeof activeTab
  ) => {
    const yourTeam = isUserTeam(match.t1) || isUserTeam(match.t2);
    const visible = Boolean(matchRowVisible[index]);
    const t1Name = resolveName(match.t1);
    const t2Name = resolveName(match.t2);
    const scoreLine = `${match.s1 ?? "–"}–${match.s2 ?? "–"}`;

    return (
      <div
        key={match.id}
        className={cn(
          "relative overflow-hidden rounded-[14px] border px-3.5 py-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          yourTeam
            ? "border-[var(--ff-accent-border)] bg-gradient-to-br from-[#0b160e] to-[#0f1115]"
            : "border-[rgba(255,255,255,0.06)] bg-[var(--ff-bg-card)]",
          visible ? "translate-y-0 opacity-100" : "translate-y-[10px] opacity-0"
        )}
      >
        {yourTeam ? (
          <div
            className="absolute bottom-0 left-0 top-0 w-[3px] bg-[var(--ff-accent-text)]"
            aria-hidden
          />
        ) : null}
        <div
          className={cn(
            "mb-2.5 font-ff-ui text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--ff-fg-faint)]",
            yourTeam && "pl-2"
          )}
        >
          {matchCardEyebrow(match, tab)}
        </div>

        <div
          className={cn(
            "grid grid-cols-[1fr_auto_1fr] items-center gap-2.5",
            yourTeam && "pl-2"
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative h-[36px] w-[36px] shrink-0 overflow-hidden rounded border border-[var(--ff-hairline)] bg-black/20">
              {resolveFlag(match.t1) ? (
                <img
                  src={resolveFlag(match.t1)}
                  alt={t1Name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center font-ff-ui text-[9px] text-[var(--ff-fg-faint)]">
                  {match.t1?.substring(0, 2).toUpperCase() ?? "—"}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-ff-ui text-[14px] font-semibold text-[var(--ff-fg-secondary)]">
                {t1Name}
              </div>
              {isUserTeam(match.t1) ? (
                <div className="font-ff-ui text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--ff-accent-text)]">
                  SQUAD
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-[64px] shrink-0 text-center">
            {tab === "upcoming" ? (
              <>
                <div className="font-ff-display text-base font-extrabold leading-tight tracking-tight text-[var(--ff-fg-primary)]">
                  {match.kickoffTime ? formatKickoff(match.kickoffTime) : "TBD"}
                </div>
                <div className="mt-0.5 font-ff-ui text-[8px] font-medium uppercase tracking-[0.1em] text-[var(--ff-fg-faint)]">
                  vs
                </div>
              </>
            ) : (
              <>
                <div className="font-ff-display text-[32px] font-extrabold leading-none tracking-tight text-[var(--ff-fg-primary)]">
                  {scoreLine}
                </div>
                <div className="mt-0.5 font-ff-ui text-[8px] font-medium uppercase tracking-[0.1em] text-[var(--ff-fg-faint)]">
                  vs
                </div>
              </>
            )}
          </div>

          <div className="flex min-w-0 flex-row-reverse items-center gap-2.5 text-right">
            <div className="relative h-[36px] w-[36px] shrink-0 overflow-hidden rounded border border-[var(--ff-hairline)] bg-black/20">
              {resolveFlag(match.t2) ? (
                <img
                  src={resolveFlag(match.t2)}
                  alt={t2Name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center font-ff-ui text-[9px] text-[var(--ff-fg-faint)]">
                  {match.t2?.substring(0, 2).toUpperCase() ?? "—"}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-ff-ui text-[14px] font-semibold text-[var(--ff-fg-secondary)]">
                {t2Name}
              </div>
              {isUserTeam(match.t2) ? (
                <div className="font-ff-ui text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--ff-accent-text)]">
                  SQUAD
                </div>
              ) : null}
            </div>
          </div>
        </div>


        {match.impact && tab === "live" ? (
          <p className="mt-2 text-center font-ff-ui text-xs font-semibold text-[var(--ff-accent-text)]">
            {match.impact}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 font-ff-ui text-[var(--ff-fg-primary)]">
      <div>
        <div className="mb-2 font-ff-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ff-fg-faint)]">
          Tournament stage
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
          {stagesToUse.map((stage, idx) => {
            const selected = stage.id === activeStage?.id;
            const dimmed = idx < safeStageIndex;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  if (onStageChange) onStageChange(stage.id);
                  else setActiveStageIdx(idx);
                }}
                className={cn(
                  "shrink-0 rounded-[20px] border px-3 py-1.5 font-ff-ui text-[11px] transition-colors",
                  selected
                    ? "border-[var(--ff-accent-border)] bg-[var(--ff-accent-dim)] font-semibold text-[var(--ff-accent-text)]"
                    : "border-[rgba(255,255,255,0.08)] font-normal text-[#5a6472] hover:border-[var(--ff-accent-border)]",
                  dimmed && !selected && "opacity-50"
                )}
              >
                {stage.name ?? stageLabel(stage.id)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex border-b border-[rgba(255,255,255,0.07)]">
        {(["live", "upcoming", "results"] as const).map((tab) => {
          const label =
            tab === "live" ? "Live" : tab === "upcoming" ? "Upcoming" : "Results";
          return (
            <button
              key={tab}
              type="button"
              onClick={() => { setActiveTab(tab); setFixtureSearch(""); }}
              className={cn(
                "relative -mb-px flex min-h-[44px] items-center gap-2 border-b-2 bg-transparent px-4 py-2 font-ff-ui text-[13px] transition-colors",
                activeTab === tab
                  ? "z-[1] border-[var(--ff-accent-text)] font-semibold text-[#e8eaed]"
                  : "border-transparent font-normal text-[#5a6472] hover:text-[var(--ff-fg-secondary)]"
              )}
            >
              {tab === "live" ? (
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full bg-[var(--ff-danger)]",
                    activeTab === "live" && "ff-live-dot"
                  )}
                  aria-hidden
                />
              ) : null}
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "upcoming" && (
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ff-fg-faint)]"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Search fixtures…"
            value={fixtureSearch}
            onChange={(e) => setFixtureSearch(e.target.value)}
            className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[var(--ff-bg-card)] py-2.5 pl-9 pr-4 font-ff-ui text-[13px] text-[var(--ff-fg-secondary)] placeholder:text-[var(--ff-fg-faint)] focus:border-[var(--ff-accent-border)] focus:outline-none"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 pt-1 md:grid-cols-2">
        {isLoading ? (
          <div className="py-10 text-center font-ff-ui text-sm text-[var(--ff-fg-quiet)]">
            Loading matches…
          </div>
        ) : visibleMatches.length > 0 ? (
          visibleMatches.map((match, index) =>
            renderFfMatchCard(match, index, activeTab)
          )
        ) : activeTab === "live" ? (
          <div className="col-span-full px-2 pb-6 pt-10 text-center">
            <div className="mb-3 text-[42px] leading-none" aria-hidden>⚽</div>
            <p className="font-ff-display text-2xl font-bold text-[var(--ff-fg-faint)]">No Live Matches</p>
            <p className="mt-1 font-ff-ui text-[13px] text-[var(--ff-fg-secondary)]">Check Upcoming for next fixtures</p>
          </div>
        ) : activeTab === "upcoming" ? (
          <div className="col-span-full px-2 pb-6 pt-10 text-center">
            <div className="mb-3 text-[42px] leading-none" aria-hidden>⚽</div>
            <p className="font-ff-display text-2xl font-bold text-[var(--ff-fg-faint)]">{fixtureSearch.trim() ? "No matches found" : "No Upcoming Matches"}</p>
            <p className="mt-1 font-ff-ui text-[13px] text-[var(--ff-fg-secondary)]">{fixtureSearch.trim() ? "Try a different team name or group" : "Fixtures will appear here when scheduled"}</p>
          </div>
        ) : (
          <div className="col-span-full px-2 pb-6 pt-10 text-center">
            <div className="mb-3 text-[42px] leading-none" aria-hidden>⚽</div>
            <p className="font-ff-display text-2xl font-bold text-[var(--ff-fg-faint)]">No Results Yet</p>
            <p className="mt-1 font-ff-ui text-[13px] text-[var(--ff-fg-secondary)]">Results appear here after matches finish</p>
          </div>
        )}
      </div>

      {!hasRealStages ? (
        <p className="text-center font-ff-ui text-[11px] text-[var(--ff-fg-quieter)]">
          Match feed unavailable — check back after fixtures load.
        </p>
      ) : null}
    </div>
  );
};

export default DashboardBracket;
