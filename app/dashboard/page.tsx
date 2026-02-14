"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppShellV0 } from "@/components/app-shell-v0";
import { auth, db, functions } from "@/lib/firebase";
import { fetchTeamsByIds } from "@/lib/dashboardData";
import { buildMainNavItems } from "@/lib/mainNav";
import type { User } from "@/types";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { httpsCallable } from "firebase/functions";

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import {
  Bell,
  BellOff,
  Clock,
  Tv,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/** ---------- ICON COMPONENTS (from your HTML) ---------- **/
const IconBase = ({
  size = 24,
  className = "",
  children,
}: {
  size?: number;
  className?: string;
  children: React.ReactNode;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const Trophy = (props: any) => (
  <IconBase {...props}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </IconBase>
);
const Shield = (props: any) => (
  <IconBase {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </IconBase>
);
const ChevronRight = (props: any) => (
  <IconBase {...props}>
    <path d="m9 18 6-6-6-6" />
  </IconBase>
);
const ChevronLeft = (props: any) => (
  <IconBase {...props}>
    <path d="m15 18-6-6 6-6" />
  </IconBase>
);
const TrendingUp = (props: any) => (
  <IconBase {...props}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </IconBase>
);
const Crown = (props: any) => (
  <IconBase {...props}>
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </IconBase>
);
const X = (props: any) => (
  <IconBase {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </IconBase>
);
const Search = (props: any) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </IconBase>
);
const CheckCircle2 = (props: any) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </IconBase>
);
const AlertTriangle = (props: any) => (
  <IconBase {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </IconBase>
);
const Loader2 = (props: any) => (
  <IconBase {...props}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </IconBase>
);

/** ---------- Small UI helpers ---------- **/
const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-white/10 rounded ${className}`} />
);

type Department = "Primary" | "Secondary" | "Admin";
type DashboardTab = "portfolio" | "leaderboard" | "bracket" | "market";

function parseDashboardTab(tabParam: string | null): DashboardTab {
  const normalized = (tabParam ?? "").trim().toLowerCase();
  if (normalized === "leaderboard" || normalized === "board") {
    return "leaderboard";
  }
  if (normalized === "bracket" || normalized === "live") {
    return "bracket";
  }
  if (normalized === "market" || normalized === "transfer") {
    return "market";
  }
  return "portfolio";
}

type UITeam = {
  id: string;
  name: string;
  group: string;
  tier: number;
  flagUrl: string;
};

function toUITeam(id: string, t: any | null): UITeam {
  return {
    id,
    name: (t?.name as string) ?? id,
    group: (t?.group as string) ?? "?",
    tier: typeof t?.tier === "number" ? t.tier : Number(t?.tier ?? 0),
    flagUrl: (t?.flagUrl as string) ?? "",
  };
}

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

function tierIcon(tier: number) {
  if (tier === 1) return "👑";
  if (tier === 2) return "⚡";
  if (tier === 3) return "🔥";
  return "💪";
}

function TierPill({ tier }: { tier: number }) {
  return (
    <span
      className={[
        "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border",
        tierPillClass(tier),
      ].join(" ")}
    >
      {tierIcon(tier)} Tier {tier} • {tierLabel(tier)}
    </span>
  );
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function calculateTeamPoints(team: Record<string, any> | null | undefined): number {
  if (!team) return 0;
  const wins = Number(team.wins ?? 0);
  const draws = Number(team.draws ?? 0);
  const goalsScored = Number(team.goalsScored ?? 0);
  const cleanSheets = Number(team.cleanSheets ?? 0);
  const redCards = Number(team.redCards ?? 0);
  const yellowCards = Number(team.yellowCards ?? 0);

  return wins * 3 + draws + goalsScored + cleanSheets - redCards - yellowCards * 0.5;
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

/** ---------- LEADERBOARD (your UI; now powered by Firestore snapshot) ---------- **/
type LBUser = {
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

type SquadTeamVM = {
  id: string;
  name: string;
  group?: string;
  tier?: number;
  flagUrl?: string;
  role: "featured" | "drawn";
  contribution: number; // placeholder 0
};

type SquadVM = {
  userId: string;
  displayName: string;
  totalScore: number; // placeholder 0
  featured: SquadTeamVM | null;
  drawn: SquadTeamVM[];
};

const Leaderboard = ({
  data = [],
  isLoading = false,
  fetchSquad,
  currentUserId,
}: {
  data: LBUser[];
  isLoading: boolean;
  fetchSquad: (userId: string, displayNameFallback: string) => Promise<SquadVM>;
  currentUserId?: string | null;
}) => {
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
    } catch (e: any) {
      console.error(e);
      setSquadErr(e?.message ?? "Failed to load squad details.");
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
    () => sorted.some((u: any) => Boolean(u?.department || u?.dept)),
    [sorted]
  );
  const deptFromData = useMemo(() => {
    const set = new Set<string>();
    sorted.forEach((u: any) => {
      const dept = u?.department ?? u?.dept;
      if (dept) set.add(String(dept));
    });
    return Array.from(set);
  }, [sorted]);
  const deptFilters = deptFromData.length
    ? deptFromData
    : [
        "Engineering",
        "Marketing",
        "Design",
        "Sales",
        "HR",
        "Finance",
        "Operations",
        "Product",
      ];

  const filteredList = useMemo(() => {
    const source =
      hasDeptData && selectedDept
        ? sorted.filter(
            (u: any) => (u?.department ?? u?.dept) === selectedDept
          )
        : sorted;
    return source.filter((u) => !topIds.has(u.id));
  }, [hasDeptData, selectedDept, sorted, topIds]);

  return (
    <div className="relative min-h-[500px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Leaderboard</h2>
            <p className="text-xs text-muted-foreground">
              {sorted.length} Participants
            </p>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-200">
          v0 layout active
        </div>
        <div className="text-emerald-300 text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          LIVE
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
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
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
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
          {/* Top 3 Podium */}
          <div className="grid grid-cols-3 gap-4 mb-8 px-4">
            {/* 2nd Place */}
            <div className="flex flex-col items-center pt-8">
              <div className="relative mb-3">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-400 to-slate-200 flex items-center justify-center shadow-lg ring-4 ring-slate-400/20">
                  <span className="text-3xl font-bold text-slate-800">2</span>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground text-center line-clamp-1">
                {topThree[1]?.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                {Number(topThree[1]?.totalScore ?? 0).toLocaleString()} pts
              </p>
              {topThree[1]?.teams?.[0] && (
                <div className="flex gap-1 mt-2">
                  {topThree[1].teams.slice(0, 3).map((t, i) => (
                    <div key={i} className="w-5 h-5 text-xs">
                      {(t.name ?? "--").slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center">
              <div className="relative mb-3">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-500 via-amber-500 to-yellow-300 flex items-center justify-center shadow-xl ring-4 ring-yellow-500/30">
                  <span className="text-4xl font-bold text-amber-900">1</span>
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Crown className="w-8 h-8 text-yellow-500 drop-shadow-lg" />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                  <Trophy className="w-3 h-3 text-amber-900" />
                </div>
              </div>
              <p className="text-base font-bold text-foreground text-center line-clamp-1">
                {topThree[0]?.name ?? "—"}
              </p>
              <p className="text-sm text-primary font-bold mt-1">
                {Number(topThree[0]?.totalScore ?? 0).toLocaleString()} pts
              </p>
              {topThree[0]?.teams?.[0] && (
                <div className="flex gap-1 mt-2">
                  {topThree[0].teams.slice(0, 3).map((t, i) => (
                    <div key={i} className="w-5 h-5 text-xs">
                      {(t.name ?? "--").slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center pt-12">
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-600 to-amber-700 flex items-center justify-center shadow-lg ring-4 ring-orange-600/20">
                  <span className="text-2xl font-bold text-amber-100">3</span>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              </div>
              <p className="text-sm font-semibold text-foreground text-center line-clamp-1">
                {topThree[2]?.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                {Number(topThree[2]?.totalScore ?? 0).toLocaleString()} pts
              </p>
              {topThree[2]?.teams?.[0] && (
                <div className="flex gap-1 mt-2">
                  {topThree[2].teams.slice(0, 3).map((t, i) => (
                    <div key={i} className="w-5 h-5 text-xs">
                      {(t.name ?? "--").slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Department Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-6">
            <button
              onClick={() => setSelectedDept(null)}
              className={[
                "shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
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
                  "shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
                  selectedDept === dept
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                ].join(" ")}
              >
                By {dept}
              </button>
            ))}
            <button
              disabled
              className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold bg-card border border-border text-muted-foreground/50 cursor-not-allowed"
            >
              Awards
            </button>
          </div>

          {/* Rankings List */}
          <div className="space-y-2">
            {filteredList.length > 0 ? filteredList.map((user) => {
              const isYou = Boolean(currentUserId && user.id === currentUserId);
              const dept = (user as any)?.department ?? (user as any)?.dept;
              return (
                <div
                  key={user.id}
                  onClick={() => openDrawerFor(user)}
                  className={[
                    "flex items-center gap-4 p-4 bg-card border border-border rounded-xl transition-all cursor-pointer hover:bg-card/80",
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
            }) : (
              [...Array(6)].map((_, i) => (
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
              ))
            )}
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
              "animate-in slide-in-from-right duration-500", // slower slide
              "shadow-[0_30px_80px_rgba(0,0,0,0.35)]", // stronger shadow
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
                    <span className="text-[10px] text-muted-foreground/70">(placeholder)</span>
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
                <div className="grid grid-cols-2 gap-5">
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
                <div className="grid grid-cols-2 gap-5">
                  {squadTeams.length > 0 ? (
                    squadTeams.map((team) => {
                      const isCaptain = team.role === "featured";
                      const tier = Number(team.tier ?? 0);
                      const group = String(team.group ?? "—");
                      const teamId = String(team.id ?? "—");
                      const flagUrl = String(team.flagUrl ?? "");

                      return (
                        <div
                          key={`${team.role}:${teamId}`}
                          className={[
                            "relative p-5 rounded-2xl flex flex-col justify-between min-h-[180px]",
                            "bg-card/70 border border-border",
                            "shadow-[0_12px_30px_rgba(0,0,0,0.10)]", // per-card shadow
                          ].join(" ")}
                        >
                          {isCaptain && (
                            <div className="absolute -top-3 -right-2 bg-orange-500/15 border border-orange-500/30 text-orange-200 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm z-10">
                              <Crown size={12} className="fill-current" />
                              CAPTAIN • 2x
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-bold text-lg text-foreground tracking-tight truncate">
                                {team.name}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground/80">
                                Team ID:{" "}
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
                                    —
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
                            <div className="text-[10px] text-muted-foreground/70 mt-1">
                              (placeholder)
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
    </div>
  );
};

/** ---------- BRACKET (your UI; placeholder match data) ---------- **/
type Stage = { id: string; name: string };
type Match = {
  id: string;
  t1?: string;
  t2?: string;
  s1?: number;
  s2?: number;
  status?: string;
  impact?: string;
  impactType?: "critical" | "high" | "normal";
  kickoffTime?: string;
  updatedAt?: string;
  isLive?: boolean;
};

const STAGE_ORDER = ["GROUP", "R32", "R16", "QF", "SF", "FINAL"] as const;
const STAGE_LABELS: Record<string, string> = {
  GROUP: "Group Stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  FINAL: "Final",
};

function stageLabel(stageId: string) {
  return STAGE_LABELS[stageId] ?? stageId;
}

function matchStatusLabel(status?: string) {
  if (status === "LIVE") return "Live";
  if (status === "FINISHED") return "Final";
  return "Scheduled";
}

function isKnownStage(stage: string): stage is (typeof STAGE_ORDER)[number] {
  return STAGE_ORDER.includes(stage as (typeof STAGE_ORDER)[number]);
}

const Bracket = ({
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
  stages: Stage[];
  matches: Record<string, Match[]>;
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

  const stagesToUse = useMemo<Stage[]>(
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
  const isLiveMatch = (match: Match) =>
    Boolean(match.isLive) || normalizeStatus(match.status) === "LIVE";
  const isFinishedMatch = (match: Match) => {
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

/** ---------- TRANSFER MARKET (live callable + live settings) ---------- **/
type MarketTeam = {
  id: string;
  name: string;
  status?: "active" | "eliminated" | "available";
  trend?: "up" | "down" | "stable";
  points?: number;
};

type TradeResult = {
  ok: boolean;
  message?: string;
};

const TransferMarket = ({
  squad = [],
  market = [],
  userScore = 0,
  penalty = 15,
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
  penalty?: number;
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
  const [confirmProgress, setConfirmProgress] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projectedScore = selectedDrop && selectedPickup ? userScore - penalty : userScore;
  const intervalRef = useRef<any>(null);
  const resetConfirmState = () => {
    setIsConfirmed(false);
    setConfirmProgress(0);
  };

  const canExecuteTrade =
    Boolean(selectedDrop && selectedPickup) &&
    transferWindowOpen &&
    transfersRemaining > 0 &&
    !transferBusy &&
    !isSubmitting;
  const tradeButtonDisabled = !canExecuteTrade;

  const startConfirm = () => {
    if (!selectedDrop || !selectedPickup || !canExecuteTrade || isConfirmed) return;

    const drop = selectedDrop;
    const pickup = selectedPickup;

    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setConfirmProgress((prev) => {
        if (prev >= 100) {
          clearInterval(intervalRef.current);
          setIsSubmitting(true);

          void onTrade({ drop, pickup })
            .then((result) => {
              if (result?.ok) {
                setIsConfirmed(true);
                return;
              }

              setIsConfirmed(false);
              setConfirmProgress(0);
            })
            .catch(() => {
              setIsConfirmed(false);
              setConfirmProgress(0);
            })
            .finally(() => {
              setIsSubmitting(false);
            });

          return 100;
        }

        return prev + 4;
      });
    }, 20);
  };

  const stopConfirm = () => {
    if (isConfirmed || isSubmitting) return;
    clearInterval(intervalRef.current);
    setConfirmProgress(0);
  };

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  const filteredAvailable = availableTeams.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase())
  );

  const transferCost = selectedPickup ? penalty : 0;

  return (
    <div className="h-full flex flex-col pb-24 md:pb-0 relative space-y-6">
      <div
        className={[
          "border rounded-xl p-4",
          transferWindowOpen
            ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
            : "bg-destructive/10 border-destructive/30",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className={`w-5 h-5 ${transferWindowOpen ? "text-amber-500" : "text-destructive"}`} />
            <div>
              <p className="font-medium text-foreground">
                {transferWindowOpen ? "Transfer Window Active" : "Transfer Window Closed"}
              </p>
              <p className="text-sm text-muted-foreground">{transferWindowLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {transfersRemaining} transfer{transfersRemaining === 1 ? "" : "s"} remaining
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{userScore}</p>
            <p className="text-xs text-muted-foreground">Current Points</p>
          </div>
        </div>
      </div>

      {transferError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {transferError}
        </div>
      )}
      {transferSuccess && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {transferSuccess}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 flex-1">
        <div className="bg-card/70 border border-border rounded-2xl overflow-hidden flex flex-col shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
          <div className="p-5 border-b border-border bg-white/5 flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Shield size={18} className="text-muted-foreground/70" /> My Squad
            </h3>
            <span className="text-xs text-muted-foreground/70 font-bold uppercase tracking-wider">
              Select to Release
            </span>
          </div>
          <div className="p-3 space-y-3 overflow-y-auto max-h-[450px]">
            {releaseTeams.length === 0 ? (
              <div className="text-center p-10 text-muted-foreground/70 italic">
                No squad teams available.
              </div>
            ) : (
              releaseTeams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    setSelectedDrop(team);
                    resetConfirmState();
                  }}
                  className={[
                    "p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all duration-200",
                    selectedDrop?.id === team.id
                      ? "bg-rose-500/15 border-rose-500/30 shadow-md ring-1 ring-rose-500/20 transform scale-[1.02]"
                      : "bg-card/70 border-border hover:border-border hover:shadow-sm",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-bold text-foreground">{team.name}</div>
                    <div className="text-xs text-muted-foreground/80 mt-1 font-medium">
                      Status:{" "}
                      <span
                        className={
                          team.status === "eliminated" ? "text-destructive" : "text-foreground/90"
                        }
                      >
                        {team.status ?? "active"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-muted-foreground font-medium">
                      {team.points ?? 0} pts
                    </div>
                    {selectedDrop?.id === team.id && (
                      <div className="text-[10px] text-rose-300 font-bold uppercase mt-1">
                        Releasing
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card/70 border border-border rounded-2xl overflow-hidden flex flex-col shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
          <div className="p-5 border-b border-border bg-white/5 flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Search size={18} className="text-muted-foreground/70" /> Market
            </h3>
            <span className="text-xs text-muted-foreground/70 font-bold uppercase tracking-wider">
              Select to Buy
            </span>
          </div>
          <div className="p-3">
            <Input
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
          </div>
          <div className="px-3 pb-3 space-y-3 overflow-y-auto max-h-[400px]">
            {filteredAvailable.length === 0 ? (
              <div className="text-center p-10 text-muted-foreground/70 italic">
                No teams found.
              </div>
            ) : (
              filteredAvailable.map((team) => (
                <div
                  key={team.id}
                  onClick={() => {
                    setSelectedPickup(team);
                    resetConfirmState();
                  }}
                  className={[
                    "p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all duration-200",
                    selectedPickup?.id === team.id
                      ? "bg-emerald-500/15 border-emerald-500/30 shadow-md ring-1 ring-emerald-500/20 transform scale-[1.02]"
                      : "bg-card/70 border-border hover:border-border hover:shadow-sm",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-bold text-foreground">{team.name}</div>
                    <div className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1 font-medium">
                      Trend:{" "}
                      <span className="text-foreground/90">{team.trend || "stable"}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-muted-foreground/80">
                      {team.points ?? 0} pts
                    </div>
                    {selectedPickup?.id === team.id && (
                      <div className="text-[10px] text-emerald-300 font-bold uppercase mt-1">
                        Buying
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 md:relative md:mt-8 bg-card/90 backdrop-blur-xl border-t md:border border-border/60 md:rounded-2xl p-6 shadow-[0_-12px_48px_rgba(0,0,0,0.12)] z-30">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center justify-between w-full md:w-auto gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest mb-1">
                Current Score
              </div>
              <div className="font-mono text-xl text-foreground/90 font-medium">{userScore}</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-px w-8 bg-white/10 mb-1"></div>
              <div className="text-xs text-orange-300 font-bold">-{transferCost} pts</div>
              <div className="h-px w-8 bg-white/10 mt-1"></div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-widest mb-1">
                Projected Score
              </div>
              <div
                className={`font-mono text-2xl font-bold ${
                  projectedScore < 0 ? "text-orange-300" : "text-foreground"
                }`}
              >
                {projectedScore}
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto">
            {isConfirmed ? (
              <div className="w-full md:w-64 bg-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={20} /> Trade Confirmed
              </div>
            ) : (
              <button
                disabled={tradeButtonDisabled}
                onMouseDown={startConfirm}
                onMouseUp={stopConfirm}
                onMouseLeave={stopConfirm}
                onTouchStart={startConfirm}
                onTouchEnd={stopConfirm}
                className={[
                  "relative w-full md:w-64 py-4 rounded-xl border font-bold text-sm uppercase tracking-wider overflow-hidden transition-all select-none",
                  tradeButtonDisabled
                    ? "bg-white/5 text-muted-foreground/70 cursor-not-allowed border-border"
                    : "bg-emerald-500 text-slate-950 cursor-pointer border-emerald-300/50 hover:bg-emerald-400 shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:scale-[1.02]",
                ].join(" ")}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 bg-white/25 transition-all duration-75 ease-linear"
                  style={{ width: `${confirmProgress}%` }}
                />
                <div className="relative z-10 flex items-center justify-center gap-2 text-inherit">
                  {isSubmitting || transferBusy
                    ? "Executing..."
                    : confirmProgress > 0
                    ? "Hold to Confirm..."
                    : !transferWindowOpen
                    ? "Window Closed"
                    : transfersRemaining <= 0
                    ? "No Transfers Left"
                    : "Hold to Trade"}
                </div>
              </button>
            )}
            <div className="text-center mt-3 text-[10px] text-muted-foreground/70 font-medium hidden md:block">
              Long press button to execute trade
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** ---------- Page ---------- **/
function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [userDoc, setUserDoc] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    parseDashboardTab(tabParam)
  );

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  // Team lookup for My Teams strip (same working approach you already used)
  const [teamsById, setTeamsById] = useState<Record<string, any>>({});
  const [loadingTeams, setLoadingTeams] = useState(false);

  // ✅ Leaderboard state (now from Firestore snapshot)
  const [leaderboardData, setLeaderboardData] = useState<LBUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // ✅ Match Center state (live from Firestore)
  const [bracketStages, setBracketStages] = useState<Stage[]>([]);
  const [bracketMatches, setBracketMatches] = useState<Record<string, Match[]>>(
    {}
  );
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchTeamNames, setMatchTeamNames] = useState<Record<string, string>>(
    {}
  );
  const [matchTeamFlags, setMatchTeamFlags] = useState<Record<string, string>>(
    {}
  );
  const matchTeamFlagsRef = useRef<Record<string, string>>({});
  const matchTeamNamesRef = useRef<Record<string, string>>({});
  const pendingTeamIdsRef = useRef<Set<string>>(new Set());
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [lastMatchUpdate, setLastMatchUpdate] = useState<string>("");
  const [marketTeamsById, setMarketTeamsById] = useState<Record<string, any>>({});
  const [loadingMarketTeams, setLoadingMarketTeams] = useState(false);
  const [transferNowMs, setTransferNowMs] = useState(() => Date.now());
  const [transferWindowConfig, setTransferWindowConfig] = useState<{
    enabled: boolean;
    startsAtMs: number | null;
    endsAtMs: number | null;
  }>({
    enabled: false,
    startsAtMs: null,
    endsAtMs: null,
  });
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [transferSuccess, setTransferSuccess] = useState("");

  const signedIn = useMemo(() => Boolean(uid), [uid]);
  const department: Department | null = (userDoc as any)?.department ?? null;

  const activeNavId = useMemo(() => {
    if (activeTab === "portfolio") return "portfolio";
    if (activeTab === "market") return "transfer";
    if (activeTab === "bracket") return "live";
    if (activeTab === "leaderboard") return "leaderboard";
    return "portfolio";
  }, [activeTab]);

  const navItems = buildMainNavItems({
    signedIn,
    authBusy: checkingAuth,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
    onPortfolio: () => {
      setActiveTab("portfolio");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    onTransfer: () => setActiveTab("market"),
    onLeaderboard: () => setActiveTab("leaderboard"),
    onLive: () => setActiveTab("bracket"),
  });

  useEffect(() => {
    matchTeamNamesRef.current = matchTeamNames;
  }, [matchTeamNames]);

  useEffect(() => {
    matchTeamFlagsRef.current = matchTeamFlags;
  }, [matchTeamFlags]);

  useEffect(() => {
    const tabFromUrl = parseDashboardTab(tabParam);
    setActiveTab((prev) => (prev === tabFromUrl ? prev : tabFromUrl));
  }, [tabParam]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTransferNowMs(Date.now());
    }, 15000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeTab !== "market") return;
    setTransferError("");
    setTransferSuccess("");
  }, [activeTab]);

  useEffect(() => {
    if (!signedIn) return;
    if (selectedStageId) return;
    if (!bracketStages.length) return;

    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("dashboard:stage")
        : null;
    if (stored) {
      setSelectedStageId(stored);
      return;
    }

    setSelectedStageId(bracketStages[0]?.id ?? "");
  }, [signedIn, selectedStageId, bracketStages]);

  const entry = (userDoc as any)?.entry;
  const portfolio = Array.isArray((userDoc as any)?.portfolio)
    ? (userDoc as any).portfolio
    : [];

  const featuredTeamId =
    entry?.featuredTeamId ??
    portfolio.find((p: any) => p.role === "featured")?.teamId ??
    null;

  const drawnTeamIds: string[] = Array.isArray(entry?.drawnTeamIds)
    ? entry.drawnTeamIds
    : portfolio
        .filter((p: any) => p.role === "drawn")
        .map((p: any) => p.teamId);

  const teamIdsToLoad = useMemo(() => {
    const ids = new Set<string>();
    if (featuredTeamId) ids.add(String(featuredTeamId));
    (drawnTeamIds ?? []).slice(0, 5).forEach((id) => ids.add(String(id)));
    return Array.from(ids);
  }, [featuredTeamId, drawnTeamIds]);

  const teamIdsToLoadKey = useMemo(
    () => teamIdsToLoad.slice().sort().join("|"),
    [teamIdsToLoad]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUid(u?.uid ?? null);
      setDisplayName(u?.displayName ?? "");
      setCheckingAuth(false);

      setUserDoc(null);
      setTeamsById({});
      setLeaderboardData([]);
      setError("");
      setStatus("");

      if (!u) return;

      setLoadingUser(true);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) setUserDoc(snap.data() as User);
        else setUserDoc(null);
      } catch (e: any) {
        console.error(e);
        setError(`[users] ${e?.message ?? "Failed to load your entry."}`);
      } finally {
        setLoadingUser(false);
      }
    });

    return () => unsub();
  }, []);

  // Department gate (same behaviour you already tested)
  useEffect(() => {
    if (!signedIn) return;
    if (loadingUser) return;
    if (error) return;
    if (!department) router.replace("/department?next=/dashboard");
  }, [signedIn, loadingUser, error, department, router]);

  // Load the 1 + 5 teams used in the strip
  useEffect(() => {
    let cancelled = false;

    async function loadTeamsByKey(key: string) {
      if (!signedIn) return;

      if (!key) {
        setTeamsById((prev) => (Object.keys(prev).length ? {} : prev));
        return;
      }

      const ids = key.split("|").filter(Boolean);
      if (!ids.length) return;

      setLoadingTeams(true);
      try {
        const q = query(
          collection(db, "teams"),
          where(documentId(), "in", ids)
        );
        const snap = await getDocs(q);

        const map: Record<string, any> = {};
        snap.forEach((d) => (map[d.id] = { id: d.id, ...d.data() }));

        if (!cancelled) setTeamsById(map);
      } catch (e: any) {
        console.error(e);
        if (!cancelled)
          setError(`[teams] ${e?.message ?? "Failed to load team details."}`);
      } finally {
        if (!cancelled) setLoadingTeams(false);
      }
    }

    loadTeamsByKey(teamIdsToLoadKey);
    return () => {
      cancelled = true;
    };
  }, [signedIn, teamIdsToLoadKey]);

  // ✅ Live leaderboard via Firestore snapshot
  useEffect(() => {
    if (!signedIn) return;

    setLoadingLeaderboard(true);

    const ref = doc(db, "leaderboard", "current");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setLeaderboardData([]);
          setLoadingLeaderboard(false);
          return;
        }

        const payload = snap.data() as any;
        const rows = Array.isArray(payload?.rows) ? payload.rows : [];

        const mapped: LBUser[] = rows
          .map((r: any, idx: number) => ({
            id: String(r.userId ?? r.id ?? ""),
            rank: Number(r.rank ?? idx + 1),
            name: String(r.displayName ?? r.name ?? "Anonymous"),
            totalScore: Number(r.totalScore ?? 0),
            teams: [], // drawer is hydrated via getSquadDetails
          }))
          .filter((row: LBUser) => Boolean(row.id));

        setLeaderboardData(mapped);
        setLoadingLeaderboard(false);
      },
      (err) => {
        const code = typeof err?.code === "string" ? err.code : "";
        if (code === "permission-denied") {
          setLeaderboardData([]);
          setLoadingLeaderboard(false);
          return;
        }
        console.error(err);
        setError(
          `[leaderboard] ${err?.message ?? "Failed to load leaderboard."}`
        );
        setLoadingLeaderboard(false);
      }
    );

    return () => {
      unsub();
    };
  }, [signedIn]);

  // ✅ Live Match Center via Firestore snapshot
  useEffect(() => {
    if (!signedIn) {
      setBracketStages([]);
      setBracketMatches({});
      setLoadingMatches(false);
      setMatchTeamNames({});
      setMatchTeamFlags({});
      matchTeamNamesRef.current = {};
      matchTeamFlagsRef.current = {};
      pendingTeamIdsRef.current = new Set();
      return;
    }

    setLoadingMatches(true);
    const q = query(collection(db, "matches"), orderBy("kickoffTime", "asc"));

    let cancelled = false;

    const unsub = onSnapshot(
      q,
      (snap) => {
        let latestUpdatedAt = "";
        const teamIds = new Set<string>();
        const grouped: Record<string, Array<{ match: Match; kickoffTime: string }>> =
          {};

        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const stage = String(data?.stage ?? "GROUP");
          const kickoffTime =
            typeof data?.kickoffTime === "string" ? data.kickoffTime : "";
          const updatedAt =
            typeof data?.lastUpdated === "string"
              ? data.lastUpdated
              : data?.lastUpdated?.toDate?.()
              ? data.lastUpdated.toDate().toISOString()
              : "";

          const home = String(data?.homeTeamId ?? "TBD");
          const away = String(data?.awayTeamId ?? "TBD");

          if (home && home !== "TBD") teamIds.add(home);
          if (away && away !== "TBD") teamIds.add(away);

          const s1 =
            typeof data?.homeScore === "number" ? data.homeScore : undefined;
          const s2 =
            typeof data?.awayScore === "number" ? data.awayScore : undefined;

          const statusRaw = String(data?.status ?? "SCHEDULED");
          const impact = statusRaw === "LIVE" ? "Match live" : undefined;
          const impactType = statusRaw === "LIVE" ? "high" : undefined;

          const match: Match = {
            id: docSnap.id,
            t1: home,
            t2: away,
            s1,
            s2,
            status: matchStatusLabel(statusRaw),
            impact,
            impactType,
            kickoffTime,
            updatedAt,
            isLive: statusRaw === "LIVE",
          };

          if (!grouped[stage]) grouped[stage] = [];
          grouped[stage].push({ match, kickoffTime });

          if (updatedAt && updatedAt > latestUpdatedAt) {
            latestUpdatedAt = updatedAt;
          }
        });

        const orderedStages = STAGE_ORDER.filter((stage) =>
          Boolean(grouped[stage]?.length)
        ).map((stage) => ({ id: stage, name: stageLabel(stage) }));

        const extraStages = Object.keys(grouped)
          .filter((stage) => !isKnownStage(stage))
          .sort()
          .map((stage) => ({ id: stage, name: stageLabel(stage) }));

        const matchesByStage: Record<string, Match[]> = {};
        Object.keys(grouped).forEach((stage) => {
          matchesByStage[stage] = grouped[stage]
            .sort((a, b) =>
              (a.kickoffTime || "").localeCompare(b.kickoffTime || "")
            )
            .map((item) => item.match);
        });

        setBracketStages([...orderedStages, ...extraStages]);
        setBracketMatches(matchesByStage);
        setLastMatchUpdate(latestUpdatedAt);
        setLoadingMatches(false);

        const missing = Array.from(teamIds).filter(
          (id) =>
            !matchTeamNamesRef.current[id] &&
            !pendingTeamIdsRef.current.has(id)
        );

        if (missing.length) {
          missing.forEach((id) => pendingTeamIdsRef.current.add(id));

          fetchTeamsByIds(missing)
            .then((teamsMap) => {
              if (cancelled) return;
              const updates: Record<string, string> = {};
              const flagUpdates: Record<string, string> = {};
              Object.entries(teamsMap).forEach(([id, team]) => {
                const name =
                  typeof team?.name === "string" && team.name.trim().length
                    ? team.name.trim()
                    : id;
                updates[id] = name;
                if (typeof team?.flagUrl === "string" && team.flagUrl.trim()) {
                  flagUpdates[id] = team.flagUrl.trim();
                }
              });

              if (Object.keys(updates).length) {
                setMatchTeamNames((prev) => ({ ...prev, ...updates }));
              }
              if (Object.keys(flagUpdates).length) {
                setMatchTeamFlags((prev) => ({ ...prev, ...flagUpdates }));
              }
            })
            .catch((err) => {
              console.error(err);
            })
            .finally(() => {
              missing.forEach((id) => pendingTeamIdsRef.current.delete(id));
            });
        }
      },
      (err) => {
        const code = typeof err?.code === "string" ? err.code : "";
        if (code === "permission-denied") {
          setBracketStages([]);
          setBracketMatches({});
          setLoadingMatches(false);
          return;
        }
        console.error(err);
        setError(`[matches] ${err?.message ?? "Failed to load matches."}`);
        setLoadingMatches(false);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) {
      setTransferWindowConfig({
        enabled: false,
        startsAtMs: null,
        endsAtMs: null,
      });
      return;
    }

    const transferWindowRef = doc(db, "settings", "transferWindow");
    const unsub = onSnapshot(
      transferWindowRef,
      (snap) => {
        if (!snap.exists()) {
          setTransferWindowConfig({
            enabled: false,
            startsAtMs: null,
            endsAtMs: null,
          });
          return;
        }

        const data = snap.data() as any;
        setTransferWindowConfig({
          enabled: data?.enabled === true,
          startsAtMs: toMillis(data?.startsAt),
          endsAtMs: toMillis(data?.endsAt),
        });
      },
      (err) => {
        const code = typeof err?.code === "string" ? err.code : "";
        if (code === "permission-denied") {
          setTransferWindowConfig({
            enabled: false,
            startsAtMs: null,
            endsAtMs: null,
          });
          return;
        }

        console.error(err);
        setError(
          `[transfer-window] ${err?.message ?? "Failed to load transfer window."}`
        );
      }
    );

    return () => unsub();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) {
      setMarketTeamsById({});
      setLoadingMarketTeams(false);
      return;
    }

    setLoadingMarketTeams(true);
    const teamsRef = collection(db, "teams");
    const unsub = onSnapshot(
      teamsRef,
      (snap) => {
        const next: Record<string, any> = {};
        snap.forEach((docSnap) => {
          next[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        setMarketTeamsById(next);
        setLoadingMarketTeams(false);
      },
      (err) => {
        const code = typeof err?.code === "string" ? err.code : "";
        if (code === "permission-denied") {
          setMarketTeamsById({});
          setLoadingMarketTeams(false);
          return;
        }

        console.error(err);
        setTransferError(`[market] ${err?.message ?? "Failed to load market teams."}`);
        setLoadingMarketTeams(false);
      }
    );

    return () => unsub();
  }, [signedIn]);

  const featuredDisplay: UITeam | null = useMemo(() => {
    if (!featuredTeamId) return null;
    const id = String(featuredTeamId);
    return toUITeam(id, teamsById[id] ?? null);
  }, [featuredTeamId, teamsById]);

  const drawnDisplay: UITeam[] = useMemo(() => {
    return (drawnTeamIds ?? []).slice(0, 5).map((id) => {
      const sid = String(id);
      return toUITeam(sid, teamsById[sid] ?? null);
    });
  }, [drawnTeamIds, teamsById]);

  const userTeamIds = useMemo(() => {
    const set = new Set<string>();
    if (featuredTeamId) set.add(String(featuredTeamId));
    (drawnTeamIds ?? []).forEach((id) => set.add(String(id)));
    return Array.from(set);
  }, [drawnTeamIds, featuredTeamId]);

  async function handleGoogleSignIn() {
    setError("");
    setStatus("");
    try {
      setStatus("Opening Google sign-in...");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      setStatus("");
    } catch (e: any) {
      console.error(e);
      setStatus("");
      setError(e?.message ?? "Sign-in failed.");
    }
  }

  async function handleSignOut() {
    setError("");
    setStatus("");
    try {
      setStatus("Signing out...");
      await signOut(auth);
      setStatus("");
    } catch (e: any) {
      console.error(e);
      setStatus("");
      setError(e?.message ?? "Sign-out failed.");
    }
  }

  // ✅ Drawer hydration: fetch a user's squad via callable (safe cross-user access)
  async function fetchSquadDetails(
    userId: string,
    displayNameFallback: string
  ): Promise<SquadVM> {
    const fn = httpsCallable(functions, "getSquadDetails");
    const res = await fn({ userId });

    const payload = res.data as any;

    const featuredRaw = payload?.featured ?? null;
    const drawnRaw = Array.isArray(payload?.drawn) ? payload.drawn : [];

    const featured: SquadTeamVM | null = featuredRaw
      ? {
          id: String(featuredRaw.id ?? featuredRaw.teamId ?? ""),
          name: String(featuredRaw.name ?? "Featured"),
          group: String(featuredRaw.group ?? ""),
          tier: Number(featuredRaw.tier ?? 4),
          flagUrl: String(featuredRaw.flagUrl ?? ""),
          role: "featured",
          contribution: 0,
        }
      : null;

    const drawn: SquadTeamVM[] = drawnRaw
      .map((t: any) => ({
        id: String(t.id ?? t.teamId ?? ""),
        name: String(t.name ?? "Team"),
        group: String(t.group ?? ""),
        tier: Number(t.tier ?? 4),
        flagUrl: String(t.flagUrl ?? ""),
        role: "drawn" as const,
        contribution: 0,
      }))
      .filter((t: SquadTeamVM) => Boolean(t.id));

    return {
      userId: String(payload?.userId ?? userId),
      displayName: String(payload?.displayName ?? displayNameFallback),
      totalScore: 0,
      featured,
      drawn: drawn.slice(0, 5),
    };
  }

  // User's score and rank from leaderboard
  const userStats = useMemo(() => {
    const fallbackScore = Number((userDoc as any)?.totalScore ?? 0);
    if (!uid || !leaderboardData.length) return { score: fallbackScore, rank: null };
    const userEntry = leaderboardData.find((u) => u.id === uid);
    return {
      score: userEntry?.totalScore ?? fallbackScore,
      rank: userEntry?.rank ?? null,
    };
  }, [uid, leaderboardData, userDoc]);

  const remainingTransfers = Math.max(
    0,
    Number((userDoc as any)?.remainingTransfers ?? 0)
  );

  const transferWindowOpen = useMemo(() => {
    if (!transferWindowConfig.enabled) return false;
    if (
      transferWindowConfig.startsAtMs !== null &&
      transferNowMs < transferWindowConfig.startsAtMs
    ) {
      return false;
    }
    if (
      transferWindowConfig.endsAtMs !== null &&
      transferNowMs > transferWindowConfig.endsAtMs
    ) {
      return false;
    }
    return true;
  }, [transferWindowConfig, transferNowMs]);

  const transferWindowLabel = useMemo(() => {
    const formatTs = (ms: number) =>
      new Date(ms).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    if (!transferWindowConfig.enabled) {
      return "Transfers are currently disabled.";
    }
    if (
      transferWindowConfig.startsAtMs !== null &&
      transferNowMs < transferWindowConfig.startsAtMs
    ) {
      return `Opens ${formatTs(transferWindowConfig.startsAtMs)}.`;
    }
    if (
      transferWindowConfig.endsAtMs !== null &&
      transferNowMs > transferWindowConfig.endsAtMs
    ) {
      return `Closed ${formatTs(transferWindowConfig.endsAtMs)}.`;
    }
    if (transferWindowConfig.endsAtMs !== null) {
      return `Open until ${formatTs(transferWindowConfig.endsAtMs)}.`;
    }
    return "Transfers are open.";
  }, [transferWindowConfig, transferNowMs]);

  // Count active/eliminated teams
  const teamStats = useMemo(() => {
    const totalTeams = userTeamIds.length;
    const eliminated = userTeamIds.reduce((count, id) => {
      const team = marketTeamsById[id] ?? teamsById[id];
      return team?.isEliminated === true ? count + 1 : count;
    }, 0);

    return {
      active: Math.max(0, totalTeams - eliminated),
      eliminated,
      transfers: remainingTransfers,
    };
  }, [userTeamIds, marketTeamsById, teamsById, remainingTransfers]);

  const userScore = userStats.score;

  const userSquad: MarketTeam[] = useMemo(
    () =>
      (drawnTeamIds ?? []).slice(0, 5).map((rawId) => {
        const id = String(rawId);
        const team = marketTeamsById[id] ?? teamsById[id] ?? null;
        return {
          id,
          name: String(team?.name ?? id),
          status: team?.isEliminated === true ? "eliminated" : "active",
          trend: "stable",
          points: calculateTeamPoints(team),
        };
      }),
    [drawnTeamIds, marketTeamsById, teamsById]
  );

  const marketData: MarketTeam[] = useMemo(() => {
    const excluded = new Set(userTeamIds.map((id) => String(id)));

    return Object.entries(marketTeamsById)
      .filter(([teamId, team]) => !excluded.has(teamId) && team?.isEliminated !== true)
      .map(([teamId, team]) => ({
        id: teamId,
        name: String(team?.name ?? teamId),
        status: "available" as const,
        trend: "stable" as const,
        points: calculateTeamPoints(team),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [marketTeamsById, userTeamIds]);

  async function handleTrade({
    drop,
    pickup,
  }: {
    drop: MarketTeam;
    pickup: MarketTeam;
  }): Promise<TradeResult> {
    setTransferError("");
    setTransferSuccess("");

    if (!uid) {
      const msg = "You must be signed in.";
      setTransferError(msg);
      return { ok: false, message: msg };
    }
    if (!transferWindowOpen) {
      const msg = "Transfer window is closed.";
      setTransferError(msg);
      return { ok: false, message: msg };
    }
    if (remainingTransfers <= 0) {
      const msg = "No transfers remaining.";
      setTransferError(msg);
      return { ok: false, message: msg };
    }

    setTransferBusy(true);
    try {
      const fn = httpsCallable(functions, "executeTransfer");
      const res = await fn({
        dropTeamId: drop.id,
        pickupTeamId: pickup.id,
      });

      const payload = res.data as any;
      const nextTransfers = Math.max(
        0,
        Number(payload?.remainingTransfers ?? remainingTransfers - 1)
      );

      const refreshedUserSnap = await getDoc(doc(db, "users", uid));
      if (refreshedUserSnap.exists()) {
        setUserDoc(refreshedUserSnap.data() as User);
      }

      setTransferSuccess(
        `Transfer completed. ${nextTransfers} transfer${nextTransfers === 1 ? "" : "s"} remaining.`
      );

      return { ok: true };
    } catch (err) {
      const msg = friendlyErrorMessage(err, "Transfer failed.");
      setTransferError(msg);
      return { ok: false, message: msg };
    } finally {
      setTransferBusy(false);
    }
  }

  return (
    <AppShellV0 navItems={navItems} activeId={activeNavId}>
      <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 text-foreground selection:bg-primary/20 pb-20 md:pb-0">
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 bg-card/60 backdrop-blur-md text-foreground border-b border-border shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between lg:pr-[34rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-md p-1 overflow-hidden border border-white/10">
                <img
                  src="https://www.gardenschool.edu.my/wp-content/uploads/2021/09/gis-logo.png"
                  alt="GIS Logo"
                  className="w-full h-full object-contain"
                  onError={(e: any) => (e.currentTarget.style.display = "none")}
                />
              </div>
              <h1 className="font-bold text-lg tracking-tight">
                GIS 2026{" "}
                <span className="text-muted-foreground/70 font-normal">
                  WORLD CUP SWEEPSTAKE
                </span>
              </h1>
            </div>

            <div className="hidden md:block text-[12px] text-muted-foreground">
              {signedIn
                ? displayName
                  ? `Signed in as ${displayName}`
                  : "Signed in"
                : "Signed out"}
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Status / errors */}
        {error && (
          <div className="mb-4 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
            {error}
          </div>
        )}
        {status && (
          <div className="mb-4 text-sm text-foreground/90">{status}</div>
        )}

        {/* Portfolio View - Show when on "My Teams" tab */}
        {signedIn && activeTab === "portfolio" && (
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
                    <>
                      <div className="flex items-center justify-end gap-1 text-primary">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium">+12 today</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Rank #{userStats.rank} of {leaderboardData.length}</p>
                    </>
                  ) : (
                    <div className="flex items-center gap-1 text-primary">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm font-medium">Live</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Team Status Summary */}
              <div className="grid grid-cols-3 gap-3 mt-4">
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
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Teams</h2>

              {/* Featured Team */}
              {featuredDisplay && (
                <div className="bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:ring-2 hover:ring-primary/30">
                  <button
                    onClick={() => setExpandedTeam(expandedTeam === `featured-${featuredDisplay.id}` ? null : `featured-${featuredDisplay.id}`)}
                    className="w-full p-4 flex items-center gap-4 text-left"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary shadow-lg shadow-primary/20">
                        {featuredDisplay.flagUrl && (
                          <img src={featuredDisplay.flagUrl} alt={featuredDisplay.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Crown className="w-3 h-3 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-lg">{featuredDisplay.name}</span>
                        <Badge variant="secondary" className="text-[10px]">Your Pick</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <TierPill tier={featuredDisplay.tier} />
                        <span className="text-xs text-muted-foreground">Group {featuredDisplay.group}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">45</p>
                      <p className="text-xs text-muted-foreground">pts</p>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${expandedTeam === `featured-${featuredDisplay.id}` ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Expanded Details */}
                  {expandedTeam === `featured-${featuredDisplay.id}` && (
                    <div className="px-4 pb-4 border-t border-border/50">
                      <div className="pt-4 space-y-4">
                        {/* Recent Form */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Recent Form</p>
                          <div className="flex gap-1">
                            {['W', 'W', 'D', 'W', 'W'].map((result, i) => (
                              <div
                                key={i}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                  result === 'W' ? 'bg-primary/20 text-primary' :
                                  result === 'D' ? 'bg-muted text-muted-foreground' :
                                  'bg-destructive/20 text-destructive'
                                }`}
                              >
                                {result}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Next Match */}
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Clock className="w-3 h-3" />
                            <span>Next Match</span>
                          </div>
                          <p className="font-medium text-foreground">vs Mexico</p>
                          <p className="text-xs text-muted-foreground">Tomorrow 18:00</p>
                        </div>

                        {/* Points Breakdown */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Points Breakdown</p>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">18</p>
                              <p className="text-[10px] text-muted-foreground">Wins</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">12</p>
                              <p className="text-[10px] text-muted-foreground">Goals</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">9</p>
                              <p className="text-[10px] text-muted-foreground">C.Sheets</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">6</p>
                              <p className="text-[10px] text-muted-foreground">Bonus</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Drawn Teams */}
              {drawnDisplay.map((team, idx) => {
                const isEliminated = idx >= 4; // Placeholder: last 2 teams are "eliminated"
                const teamKey = `drawn-${team.id}`;
                
                return (
                  <div 
                    key={team.id} 
                    className={`bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 ${
                      isEliminated ? 'opacity-60' : ''
                    } ${expandedTeam === teamKey ? 'ring-2 ring-primary/30' : ''}`}
                  >
                    <button
                      onClick={() => setExpandedTeam(expandedTeam === teamKey ? null : teamKey)}
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
                        <p className="text-2xl font-bold text-foreground">{isEliminated ? '8' : idx === 0 ? '38' : idx === 1 ? '22' : '31'}</p>
                        <p className="text-xs text-muted-foreground">pts</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${expandedTeam === teamKey ? 'rotate-90' : ''}`} />
                    </button>

                    {/* Expanded Details */}
                    {expandedTeam === teamKey && !isEliminated && (
                      <div className="px-4 pb-4 border-t border-border/50">
                        <div className="pt-4 space-y-4">
                          {/* Recent Form */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Recent Form</p>
                            <div className="flex gap-1">
                              {(idx === 0 ? ['W', 'D', 'W', 'L', 'W'] : idx === 1 ? ['W', 'W', 'W', 'D', 'L'] : ['D', 'W', 'W', 'W', 'D']).map((result, i) => (
                                <div
                                  key={i}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                    result === 'W' ? 'bg-primary/20 text-primary' :
                                    result === 'D' ? 'bg-muted text-muted-foreground' :
                                    'bg-destructive/20 text-destructive'
                                  }`}
                                >
                                  {result}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Next Match */}
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <Clock className="w-3 h-3" />
                              <span>Next Match</span>
                            </div>
                            <p className="font-medium text-foreground">
                              {idx === 0 ? 'vs France' : idx === 1 ? 'vs Australia' : 'vs Senegal'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {idx === 0 ? 'Today 21:00' : idx === 1 ? 'Wed 15:00' : 'Thu 18:00'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab content area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          {activeTab === "leaderboard" && (
            <Leaderboard
              data={leaderboardData}
              isLoading={loadingLeaderboard}
              fetchSquad={fetchSquadDetails}
              currentUserId={uid}
            />
          )}
          {activeTab === "bracket" && (
            <Bracket
              stages={bracketStages}
              matches={bracketMatches}
              isLoading={loadingMatches}
              teamNames={matchTeamNames}
              teamFlags={matchTeamFlags}
              userTeamIds={userTeamIds}
              activeStageId={selectedStageId}
              onStageChange={(stageId) => {
                setSelectedStageId(stageId);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("dashboard:stage", stageId);
                }
              }}
              lastUpdated={lastMatchUpdate}
            />
          )}
          {activeTab === "market" && (
            <TransferMarket
              squad={userSquad}
              market={loadingMarketTeams ? [] : marketData}
              userScore={userScore}
              transferWindowOpen={transferWindowOpen}
              transferWindowLabel={transferWindowLabel}
              transfersRemaining={remainingTransfers}
              transferBusy={transferBusy}
              transferError={transferError}
              transferSuccess={transferSuccess}
              onTrade={handleTrade}
            />
          )}
        </div>
      </main>
    </div>
    </AppShellV0>
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          Loading dashboard...
        </div>
      }
    >
      <DashboardPageContent />
    </React.Suspense>
  );
}
