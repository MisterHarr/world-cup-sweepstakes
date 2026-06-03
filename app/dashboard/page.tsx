"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamicImport from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";

import { AppBrandBlock } from "@/components/AppBrandBlock";
import { UsernameBanner } from "@/components/dashboard/UsernameBanner";
import { AppOverflowMenuButton, AppShellV0 } from "@/components/app-shell-v0";
import { FeaturedFiveTopBar } from "@/components/FeaturedFiveTopBar";
import type {
  LBUser,
  SquadTeamVM,
  SquadVM,
} from "@/components/leaderboard/LeaderboardPanel";
import type {
  MarketTeam,
  TradeResult,
} from "@/components/dashboard/DashboardTransferMarket";
import {
  STAGE_ORDER,
  isKnownStage,
  matchStatusLabel,
  stageLabel,
  type BracketMatch as Match,
  type BracketStage as Stage,
} from "@/lib/bracketUtils";
import { BRANDING } from "@/lib/branding";
import { auth, db, functions } from "@/lib/firebase";
import { fetchTeamsByIds } from "@/lib/dashboardData";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import type { User } from "@/types";
import {
  getTeamRecentForm,
  getTeamNextMatch,
  type MatchResult,
  type NextMatch,
} from "@/lib/teamMatchData";

import {
  onAuthStateChanged,
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

const LeaderboardPanel = dynamicImport(
  () => import("@/components/leaderboard/LeaderboardPanel"),
  { ssr: false, loading: () => <TabPanelLoading /> }
);

const DashboardBracket = dynamicImport(
  () => import("@/components/dashboard/DashboardBracket"),
  { ssr: false, loading: () => <TabPanelLoading /> }
);

const DashboardTransferMarket = dynamicImport(
  () => import("@/components/dashboard/DashboardTransferMarket"),
  { ssr: false, loading: () => <TabPanelLoading /> }
);

const DashboardPortfolio = dynamicImport(
  () => import("@/components/dashboard/DashboardPortfolio"),
  { ssr: false, loading: () => <TabPanelLoading /> }
);

/** ---------- Small UI helpers ---------- **/
const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-white/10 rounded ${className}`} />
);

function TabPanelLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

/** Full-route placeholder while `useSearchParams` resolves (root Suspense boundary). */
function DashboardSuspenseFallback() {
  return (
    <div className="min-h-screen bg-[var(--ff-bg-app)] text-[var(--ff-fg-primary)] selection:bg-primary/20">
      <header className="sticky top-0 z-20 border-b border-[var(--ff-hairline)] bg-[var(--ff-bg-chrome)] text-[var(--ff-fg-primary)]">
        <div className="pt-safe">
          <FeaturedFiveTopBar
            className="mx-auto max-w-6xl px-4"
            brand={
              <AppBrandBlock
                variant="ff-chrome"
                title={BRANDING.shortName}
              />
            }
            liveCount={0}
            showUserTile={false}
          />
        </div>
      </header>
      <main
        className="max-w-6xl mx-auto p-4 md:p-8"
        aria-busy="true"
        aria-label="Loading dashboard"
      >
        <TabPanelLoading />
      </main>
    </div>
  );
}

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
  isEliminated?: boolean;
};

type TeamRecord = {
  name?: string;
  group?: string;
  tier?: number | string;
  flagUrl?: string;
  isEliminated?: boolean;
  wins?: number;
  draws?: number;
  cleanSheets?: number;
  goalsScored?: number;
  losses?: number;
  gf?: number;
  ga?: number;
  gd?: number;
  points?: number;
  totalScore?: number;
  coach?: string;
  confederation?: string;
  foundedYear?: number;
  fifaRank?: number;
  worldCupAppearances?: number;
  bestFinish?: string;
  countryCode?: string;
  [key: string]: unknown;
};

type IngestHealthRecord = {
  scoresDirty: boolean;
  dirtyReason?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function resolveLeaderboardUserId(row: Record<string, unknown>): string {
  return (
    toTrimmedString(row.userId) ??
    toTrimmedString(row.uid) ??
    toTrimmedString(row.id) ??
    ""
  );
}

function toUITeam(id: string, t: Record<string, unknown> | null): UITeam {
  const team = t ?? {};
  return {
    id,
    name: toTrimmedString(team.name) ?? id,
    group: toTrimmedString(team.group) ?? "?",
    tier: typeof team.tier === "number" ? team.tier : Number(team.tier ?? 0),
    flagUrl: toTrimmedString(team.flagUrl) ?? "",
    isEliminated: team.isEliminated === true,
  };
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

function toIsoString(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (!isRecord(value) || typeof value.toDate !== "function") return "";
  const date = (value.toDate as () => unknown)();
  return date instanceof Date ? date.toISOString() : "";
}

function calculateTeamPoints(
  team: Record<string, unknown> | null | undefined
): number {
  if (!team || !isRecord(team)) return 0;
  const wins = Number(team.wins ?? 0);
  const draws = Number(team.draws ?? 0);
  const goalsScored = Number(team.goalsScored ?? 0);
  const cleanSheets = Number(team.cleanSheets ?? 0);
  const redCards = Number(team.redCards ?? 0);
  const yellowCards = Number(team.yellowCards ?? 0);

  // Keep in sync with calcTeamPoints in functions/src/scoring.ts
  return wins * 3 + draws * 1 + goalsScored * 1.5 + cleanSheets * 1 - redCards * 1 - yellowCards * 0.25;
}

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const code =
    typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : "";
  if (code === "permission-denied") {
    return "You don't have permission to view this.";
  }
  if (code === "unavailable") {
    return "Service temporarily unavailable. Try again shortly.";
  }
  if (code === "auth/network-request-failed") {
    return "Network error. Check your connection.";
  }
  const raw =
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  if (!raw) return fallback;
  const cleaned = raw.replace(/^FirebaseError:\s*/i, "").trim();
  if (!cleaned) return fallback;
  if (process.env.NODE_ENV === "production") {
    return fallback;
  }
  return cleaned;
}

function normalizeStageId(value: unknown): string {
  const raw = toTrimmedString(value);
  if (!raw) return "GROUP";
  const token = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (token === "GROUP" || token === "GROUPSTAGE") return "GROUP";
  if (token === "R32" || token === "ROUND32" || token === "ROUNDOF32") {
    return "R32";
  }
  if (token === "R16" || token === "ROUND16" || token === "ROUNDOF16") {
    return "R16";
  }
  if (token === "QF" || token === "QUARTERFINAL" || token === "QUARTERFINALS") {
    return "QF";
  }
  if (token === "SF" || token === "SEMIFINAL" || token === "SEMIFINALS") {
    return "SF";
  }
  if (token === "FINAL" || token === "FINALS") return "FINAL";
  return raw.toUpperCase();
}

function normalizeMatchStatus(value: unknown): "LIVE" | "FINISHED" | "SCHEDULED" {
  const raw = toTrimmedString(value);
  const token = (raw ?? "SCHEDULED").toUpperCase().replace(/[^A-Z]/g, "");
  if (
    token === "LIVE" ||
    token === "INPLAY" ||
    token === "INPROGRESS" ||
    token === "ONGOING"
  ) {
    return "LIVE";
  }
  if (
    token === "FINISHED" ||
    token === "FINAL" ||
    token === "FT" ||
    token === "FULLTIME"
  ) {
    return "FINISHED";
  }
  return "SCHEDULED";
}

/** ---------- LEADERBOARD (your UI; now powered by Firestore snapshot) ---------- **/
/** ---------- Page ---------- **/
function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [usernameBannerDismissed, setUsernameBannerDismissed] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);

  const [userDoc, setUserDoc] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [authBusy, setAuthBusy] = useState(false);

  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    parseDashboardTab(tabParam)
  );

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  // Match data for expanded teams (lazy-loaded)
  const [teamMatchData, setTeamMatchData] = useState<
    Record<
      string,
      {
        recentForm: MatchResult[];
        nextMatch: NextMatch | null;
        loading: boolean;
      }
    >
  >({});

  // Team lookup for My Teams strip (same working approach you already used)
  const [teamsById, setTeamsById] = useState<Record<string, TeamRecord>>({});
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
  const [ingestHealth, setIngestHealth] = useState<IngestHealthRecord>({
    scoresDirty: false,
  });
  const [marketTeamsById, setMarketTeamsById] = useState<Record<string, TeamRecord>>({});
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
  const userDocData = useMemo<Record<string, unknown>>(
    () => (isRecord(userDoc) ? userDoc : {}),
    [userDoc]
  );
  const remainingTransfers = Math.max(
    0,
    Number(userDocData.remainingTransfers ?? 0)
  );

  const activeNavId = useMemo(() => {
    if (activeTab === "portfolio") return "portfolio";
    if (activeTab === "market") return "transfer";
    if (activeTab === "bracket") return "live";
    if (activeTab === "leaderboard") return "leaderboard";
    return "portfolio";
  }, [activeTab]);

  const liveMatchCount = useMemo(() => {
    let n = 0;
    for (const matches of Object.values(bracketMatches)) {
      for (const m of matches) {
        if (m.isLive) n += 1;
      }
    }
    return n;
  }, [bracketMatches]);

  useEffect(() => {
    matchTeamNamesRef.current = matchTeamNames;
  }, [matchTeamNames]);

  useEffect(() => {
    matchTeamFlagsRef.current = matchTeamFlags;
  }, [matchTeamFlags]);

  useEffect(() => {
    // Skip the null/empty case (initial load with no ?tab= param).
    // parseDashboardTab(null) = "portfolio", and if the user clicks a tab
    // before this effect fires, the null-fire would overwrite their choice.
    // The useState initializer already handles the correct default from null.
    if (!tabParam) return;
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

  const entry = isRecord(userDocData.entry) ? userDocData.entry : {};
  const portfolio = Array.isArray(userDocData.portfolio)
    ? userDocData.portfolio.filter(
        (item): item is Record<string, unknown> => isRecord(item)
      )
    : [];

  const featuredTeamId =
    toTrimmedString(entry.featuredTeamId) ??
    toTrimmedString(
      portfolio.find((p) => p.role === "featured")?.teamId
    ) ??
    null;

  const drawnTeamIds: string[] = Array.isArray(entry.drawnTeamIds)
    ? entry.drawnTeamIds
        .map((teamId) => toTrimmedString(teamId))
        .filter((teamId): teamId is string => Boolean(teamId))
    : portfolio
        .filter((p) => p.role === "drawn")
        .map((p) => toTrimmedString(p.teamId))
        .filter((teamId): teamId is string => Boolean(teamId));

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
      } catch (e: unknown) {
        console.error(e);
        setError(friendlyErrorMessage(e, "Failed to load your entry."));
      } finally {
        setLoadingUser(false);
      }
    });

    return () => unsub();
  }, []);

  // Entry gate — send users without a confirmed entry to the star team picker
  // Reveal gate — send users who haven't seen the reveal there first
  useEffect(() => {
    if (!signedIn) return;
    if (loadingUser) return;
    if (!userDoc) {
      // No Firestore doc at all (e.g. deleted by admin) — treat as new user
      router.replace("/featured-team");
      return;
    }

    const confirmedAt = userDoc.entry?.confirmedAt;
    const hasConfirmedEntry = Boolean(confirmedAt);

    if (!hasConfirmedEntry) {
      router.replace("/featured-team");
      return;
    }

    const hasTeams = userDoc.entry?.featuredTeamId && userDoc.entry?.drawnTeamIds?.length >= 5;
    const hasSeenReveal = userDoc.hasSeenReveal ?? false;

    if (hasTeams && !hasSeenReveal) {
      router.replace("/reveal");
    }
  }, [signedIn, loadingUser, userDoc, router]);

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

        const map: Record<string, TeamRecord> = {};
        snap.forEach((d) => {
          map[d.id] = { id: d.id, ...(d.data() as Record<string, unknown>) };
        });

        if (!cancelled) setTeamsById(map);
      } catch (e: unknown) {
        console.error(e);
        if (!cancelled)
          setError(friendlyErrorMessage(e, "Failed to load team details."));
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

        const payload = snap.data() as Record<string, unknown>;
        const rows = Array.isArray(payload.rows) ? payload.rows : [];

        const mapped: LBUser[] = rows
          .map((r: unknown, idx: number) => {
            const row = isRecord(r) ? r : {};
            const id = resolveLeaderboardUserId(row);
            return {
              id,
              rank: Number(row.rank ?? idx + 1),
              name: String(row.displayName ?? row.name ?? "Anonymous"),
              totalScore: Number(row.totalScore ?? 0),
              teams: [], // drawer is hydrated via getSquadDetails
            };
          })
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
        setError(friendlyErrorMessage(err, "Failed to load leaderboard."));
        setLoadingLeaderboard(false);
      }
    );

    return () => {
      unsub();
    };
  }, [signedIn]);

  // ✅ Live Match Center — one-time fetch with session cache + narrow LIVE listener
  //
  // Cost model:
  //   onSnapshot(all 104 matches) = 104 reads per user per open, every time any
  //   doc changes.  With 50 users that blows the 50k/day free tier.
  //
  //   New approach:
  //   • getDocs (full schedule) — reads 104 docs once per session, cached in
  //     localStorage for 5 minutes.  Repeat opens within the same tab = 0 reads.
  //   • onSnapshot(status == "LIVE") — reads only live match docs in real time.
  //     During quiet periods this is 0 docs.  During a live match ≈ 1–4 docs.
  //   • When a match leaves LIVE (FINISHED), invalidate the session cache and
  //     re-fetch once so the final score is correct.
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

    const MATCH_CACHE_KEY = "ff_matches_v2"; // v2 = localStorage, bump to bust old localStorage caches
    const MATCH_CACHE_TTL = 30 * 60 * 1000; // 30 minutes — persists across tab closes/reopens

    let cancelled = false;

    // ── shared doc→Match processor (used by full fetch and live merge) ──────
    const processSnapshotDocs = (
      docs: Array<{ id: string; data: () => Record<string, unknown> }>
    ) => {
      let latestUpdatedAt = "";
      const teamIds = new Set<string>();
      const grouped: Record<string, Array<{ match: Match; kickoffTime: string }>> = {};

      docs.forEach((docSnap) => {
        const data = docSnap.data();
        const stage = normalizeStageId(data.stage);
        const kickoffTime = typeof data.kickoffTime === "string" ? data.kickoffTime : "";
        const updatedAt = toIsoString(data.lastUpdated);
        const home = String(data.homeTeamId ?? "TBD");
        const away = String(data.awayTeamId ?? "TBD");
        const t1Label =
          typeof data.homePlaceholder === "string" && data.homePlaceholder.trim()
            ? data.homePlaceholder.trim() : undefined;
        const t2Label =
          typeof data.awayPlaceholder === "string" && data.awayPlaceholder.trim()
            ? data.awayPlaceholder.trim() : undefined;
        if (home && home !== "TBD" && !home.startsWith("TBD-")) teamIds.add(home);
        if (away && away !== "TBD" && !away.startsWith("TBD-")) teamIds.add(away);
        const s1 = typeof data.homeScore === "number" ? data.homeScore : undefined;
        const s2 = typeof data.awayScore === "number" ? data.awayScore : undefined;
        const statusCode = normalizeMatchStatus(data.status);
        const groupRaw = data.group ?? data.groupId ?? data.groupCode;
        const group = typeof groupRaw === "string" && groupRaw.trim().length ? groupRaw.trim() : undefined;
        const homeYellow = typeof data.homeYellowCards === "number" ? data.homeYellowCards : 0;
        const awayYellow = typeof data.awayYellowCards === "number" ? data.awayYellowCards : 0;
        const homeRed = typeof data.homeRedCards === "number" ? data.homeRedCards : 0;
        const awayRed = typeof data.awayRedCards === "number" ? data.awayRedCards : 0;
        const minute = typeof data.minute === "number" ? data.minute : null;
        const homeHT = typeof data.homeScoreHT === "number" ? data.homeScoreHT : null;
        const awayHT = typeof data.awayScoreHT === "number" ? data.awayScoreHT : null;
        const scoreHT: [number, number] | null = homeHT !== null && awayHT !== null ? [homeHT, awayHT] : null;
        const homePens = typeof data.homeScorePens === "number" ? data.homeScorePens : null;
        const awayPens = typeof data.awayScorePens === "number" ? data.awayScorePens : null;
        const scorePens: [number, number] | null = homePens !== null && awayPens !== null ? [homePens, awayPens] : null;
        const winner = data.winner === "HOME" || data.winner === "AWAY" ? data.winner : null;
        const rawGoals = Array.isArray(data.goals) ? data.goals : [];
        const goals = rawGoals
          .filter((g): g is Record<string, unknown> => typeof g === "object" && g !== null)
          .map((g) => ({
            minute: typeof g.minute === "number" ? g.minute : null,
            playerName: typeof g.playerName === "string" ? g.playerName : null,
            teamSide: g.teamSide === "away" ? "away" as const : "home" as const,
            type: (["REGULAR", "OWN_GOAL", "PENALTY", "EXTRA_TIME"].includes(String(g.type))
              ? g.type : "REGULAR") as "REGULAR" | "OWN_GOAL" | "PENALTY" | "EXTRA_TIME",
          }));
        const match: Match = {
          id: docSnap.id, t1: home, t2: away, t1Label, t2Label, s1, s2,
          status: matchStatusLabel(statusCode),
          impact: statusCode === "LIVE" ? "Match live" : undefined,
          impactType: statusCode === "LIVE" ? "high" : undefined,
          kickoffTime, updatedAt, isLive: statusCode === "LIVE", group,
          yellowCards: [homeYellow, awayYellow], redCards: [homeRed, awayRed],
          minute, scoreHT, scorePens, winner,
          goals: goals.length ? goals : undefined,
        };
        if (!grouped[stage]) grouped[stage] = [];
        grouped[stage].push({ match, kickoffTime });
        if (updatedAt && updatedAt > latestUpdatedAt) latestUpdatedAt = updatedAt;
      });

      return { grouped, teamIds, latestUpdatedAt };
    };

    // ── apply grouped result to state ────────────────────────────────────────
    const applyGrouped = (
      grouped: Record<string, Array<{ match: Match; kickoffTime: string }>>,
      teamIds: Set<string>,
      latestUpdatedAt: string
    ) => {
      if (cancelled) return;
      const orderedStages = STAGE_ORDER.filter((stage) => Boolean(grouped[stage]?.length))
        .map((stage) => ({ id: stage, name: stageLabel(stage) }));
      const extraStages = Object.keys(grouped).filter((s) => !isKnownStage(s)).sort()
        .map((stage) => ({ id: stage, name: stageLabel(stage) }));
      const matchesByStage: Record<string, Match[]> = {};
      Object.keys(grouped).forEach((stage) => {
        matchesByStage[stage] = grouped[stage]
          .sort((a, b) => (a.kickoffTime || "").localeCompare(b.kickoffTime || ""))
          .map((item) => ({ ...item.match, stageId: stage }));
      });
      setBracketStages([...orderedStages, ...extraStages]);
      setBracketMatches(matchesByStage);
      setLastMatchUpdate(latestUpdatedAt);
      setLoadingMatches(false);

      const missing = Array.from(teamIds).filter(
        (id) => !matchTeamNamesRef.current[id] && !pendingTeamIdsRef.current.has(id)
      );
      if (missing.length) {
        // Check the teams localStorage cache before going to Firestore.
        // The teams effect (declared after this one) hasn't run yet when
        // applyGrouped fires, so the ref is empty even on return visits.
        // Reading the cache here avoids the duplicate 48-read fetch.
        let resolvedFromCache = false;
        try {
          const raw = typeof window !== "undefined" ? localStorage.getItem("ff_teams_v1") : null;
          if (raw) {
            const { docs: td, ts: tts } = JSON.parse(raw) as {
              docs: Array<{ id: string; d: Record<string, unknown> }>;
              ts: number;
            };
            if (Date.now() - tts < 30 * 60 * 1000) {
              const names: Record<string, string> = {};
              const flags: Record<string, string> = {};
              td.forEach((c) => {
                names[c.id] = typeof c.d.name === "string" && c.d.name.trim() ? c.d.name.trim() : c.id;
                if (typeof c.d.flagUrl === "string" && c.d.flagUrl.trim()) flags[c.id] = c.d.flagUrl.trim();
              });
              if (Object.keys(names).length) {
                setMatchTeamNames((prev) => ({ ...prev, ...names }));
                matchTeamNamesRef.current = { ...matchTeamNamesRef.current, ...names };
              }
              if (Object.keys(flags).length) {
                setMatchTeamFlags((prev) => ({ ...prev, ...flags }));
                matchTeamFlagsRef.current = { ...matchTeamFlagsRef.current, ...flags };
              }
              resolvedFromCache = true;
            }
          }
        } catch { /* ignore corrupt cache */ }

        if (!resolvedFromCache) {
          missing.forEach((id) => pendingTeamIdsRef.current.add(id));
          fetchTeamsByIds(missing)
            .then((teamsMap) => {
              if (cancelled) return;
              const updates: Record<string, string> = {};
              const flagUpdates: Record<string, string> = {};
              Object.entries(teamsMap).forEach(([id, team]) => {
                const name = typeof team?.name === "string" && team.name.trim().length ? team.name.trim() : id;
                updates[id] = name;
                if (typeof team?.flagUrl === "string" && team.flagUrl.trim()) flagUpdates[id] = team.flagUrl.trim();
              });
              if (Object.keys(updates).length) setMatchTeamNames((prev) => ({ ...prev, ...updates }));
              if (Object.keys(flagUpdates).length) setMatchTeamFlags((prev) => ({ ...prev, ...flagUpdates }));
            })
            .catch(console.error)
            .finally(() => { missing.forEach((id) => pendingTeamIdsRef.current.delete(id)); });
        }
      }
    };

    // ── full schedule fetch (with session cache) ─────────────────────────────
    const fetchFullSchedule = async () => {
      // Try session cache first for instant render
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(MATCH_CACHE_KEY) : null;
        if (raw) {
          const { docs: cachedDocs, ts } = JSON.parse(raw) as {
            docs: Array<{ id: string; d: Record<string, unknown> }>;
            ts: number;
          };
          if (Date.now() - ts < MATCH_CACHE_TTL) {
            const { grouped, teamIds, latestUpdatedAt } = processSnapshotDocs(
              cachedDocs.map((c) => ({ id: c.id, data: () => c.d }))
            );
            applyGrouped(grouped, teamIds, latestUpdatedAt);
            return; // served from cache — skip Firestore read this open
          }
        }
      } catch { /* ignore corrupt cache */ }

      // Cache miss or expired — fetch from Firestore
      const snap = await getDocs(query(collection(db, "matches"), orderBy("kickoffTime", "asc")));
      if (cancelled) return;

      // Populate cache
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(MATCH_CACHE_KEY, JSON.stringify({
            docs: snap.docs.map((d) => ({ id: d.id, d: d.data() })),
            ts: Date.now(),
          }));
        }
      } catch { /* storage full — ignore */ }

      const { grouped, teamIds, latestUpdatedAt } = processSnapshotDocs(
        snap.docs.map((d) => ({ id: d.id, data: () => d.data() as Record<string, unknown> }))
      );
      applyGrouped(grouped, teamIds, latestUpdatedAt);
    };

    fetchFullSchedule().catch((err) => {
      if (cancelled) return;
      const code = typeof err?.code === "string" ? err.code : "";
      if (code === "permission-denied") { setBracketStages([]); setBracketMatches({}); setLoadingMatches(false); return; }
      console.error(err);
      setError(friendlyErrorMessage(err, "Failed to load live matches."));
      setLoadingMatches(false);
    });

    // ── narrow real-time listener: LIVE matches only ─────────────────────────
    // Merges live score updates into state without re-reading the full schedule.
    // When a match leaves LIVE (finished), invalidate cache + re-fetch once.
    const liveQ = query(collection(db, "matches"), where("status", "==", "LIVE"));
    const liveUnsub = onSnapshot(liveQ, (liveSnap) => {
      if (cancelled) return;

      const hasRemovals = liveSnap.docChanges().some((c) => c.type === "removed");
      if (hasRemovals) {
        // A match just finished — bust the cache so the final score is fetched
        try { if (typeof window !== "undefined") localStorage.removeItem(MATCH_CACHE_KEY); } catch { /* ignore */ }
        fetchFullSchedule().catch(console.error);
        return;
      }

      // Merge live updates into existing bracket state
      if (liveSnap.empty) return;
      setBracketMatches((prev) => {
        const next = { ...prev };
        liveSnap.docs.forEach((docSnap) => {
          const { grouped } = processSnapshotDocs([{ id: docSnap.id, data: () => docSnap.data() as Record<string, unknown> }]);
          Object.entries(grouped).forEach(([stage, items]) => {
            if (!next[stage]) return;
            const updated = [...next[stage]];
            items.forEach(({ match }) => {
              const idx = updated.findIndex((m) => m.id === match.id);
              if (idx !== -1) updated[idx] = { ...match, stageId: stage };
            });
            next[stage] = updated;
          });
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
      liveUnsub();
    };
  }, [signedIn]);


  useEffect(() => {
    if (!signedIn) {
      setIngestHealth({ scoresDirty: false });
      return;
    }

    const ref = doc(db, "ingestHealth", "current");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setIngestHealth({ scoresDirty: false });
          return;
        }

        const data = snap.data() as Record<string, unknown>;
        setIngestHealth({
          scoresDirty: data.scoresDirty === true,
          dirtyReason:
            typeof data.dirtyReason === "string" ? data.dirtyReason : null,
        });
      },
      () => {
        setIngestHealth({ scoresDirty: false });
      }
    );

    return () => unsub();
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

        const data = snap.data() as Record<string, unknown>;
        setTransferWindowConfig({
          enabled: data.enabled === true,
          startsAtMs: toMillis(data.startsAt),
          endsAtMs: toMillis(data.endsAt),
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
          friendlyErrorMessage(err, "Failed to load transfer window settings.")
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

    // Teams are cached in localStorage (30-min TTL).  On return visits this
    // costs 0 Firestore reads.  Also populates matchTeamNames/Flags so the
    // match-card display doesn't need a separate fetchTeamsByIds call.
    setLoadingMarketTeams(true);

    const TEAMS_CACHE_KEY = "ff_teams_v1";
    const TEAMS_CACHE_TTL = 30 * 60 * 1000;

    const applyTeamDocs = (docs: Array<{ id: string; d: Record<string, unknown> }>) => {
      const next: Record<string, TeamRecord> = {};
      const names: Record<string, string> = {};
      const flags: Record<string, string> = {};
      docs.forEach(({ id, d }) => {
        next[id] = { id, ...(d as Record<string, unknown>) } as TeamRecord;
        names[id] = typeof d.name === "string" && d.name.trim() ? d.name.trim() : id;
        if (typeof d.flagUrl === "string" && d.flagUrl.trim()) flags[id] = d.flagUrl.trim();
      });
      setMarketTeamsById(next);
      setMatchTeamNames((prev) => ({ ...prev, ...names }));
      setMatchTeamFlags((prev) => ({ ...prev, ...flags }));
      matchTeamNamesRef.current = { ...matchTeamNamesRef.current, ...names };
      matchTeamFlagsRef.current = { ...matchTeamFlagsRef.current, ...flags };
      setLoadingMarketTeams(false);
    };

    // Try localStorage cache first
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(TEAMS_CACHE_KEY) : null;
      if (raw) {
        const { docs, ts } = JSON.parse(raw) as {
          docs: Array<{ id: string; d: Record<string, unknown> }>;
          ts: number;
        };
        if (Date.now() - ts < TEAMS_CACHE_TTL) {
          applyTeamDocs(docs);
          return () => {};
        }
      }
    } catch { /* ignore corrupt cache */ }

    // Cache miss — fetch from Firestore and populate cache
    getDocs(collection(db, "teams"))
      .then((snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, d: d.data() as Record<string, unknown> }));
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(TEAMS_CACHE_KEY, JSON.stringify({ docs, ts: Date.now() }));
          }
        } catch { /* storage full */ }
        applyTeamDocs(docs);
      })
      .catch((err) => {
        const code = typeof err?.code === "string" ? err.code : "";
        if (code === "permission-denied") {
          setMarketTeamsById({});
          setLoadingMarketTeams(false);
          return;
        }
        console.error(err);
        setTransferError(friendlyErrorMessage(err, "Failed to load transfer market."));
        setLoadingMarketTeams(false);
      });

    return () => {};
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

  const userHasUsername = Boolean(
    typeof userDocData.username === "string" && (userDocData.username as string).trim().length > 0
  );

  // The name to show in top bar: prefer chosen username, fall back to Google name
  const topBarDisplayName = (userDocData.username as string | undefined)?.trim() || displayName || null;

  async function handleSetUsername(username: string): Promise<void> {
    const fn = httpsCallable(functions, "setUsername");
    await fn({ username });
    // Optimistically update local state so the banner disappears immediately
    setUserDoc((prev) => prev ? { ...prev, username } : prev);
  }

  async function handleGoogleSignIn() {
    if (authBusy) return;

    setError("");
    setStatus("");
    setAuthBusy(true);
    try {
      setStatus("Opening Google sign-in...");
      await signInWithGoogle(auth);
      setStatus("");
    } catch (e: unknown) {
      console.error(e);
      setStatus("");
      setError(friendlyErrorMessage(e, "Sign-in failed."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setStatus("");
    try {
      setStatus("Signing out...");
      await signOut(auth);
      setStatus("");
    } catch (e: unknown) {
      console.error(e);
      setStatus("");
      setError(friendlyErrorMessage(e, "Sign-out failed."));
    }
  }

  const navItems = buildMainNavItems({
    signedIn,
    authBusy: checkingAuth || authBusy,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
    // Within the dashboard, tab navigation uses router.replace rather than the
    // href-based <Link> component.  Using <Link> causes a null→value searchParam
    // transition on the very first click (from /dashboard with no ?tab= param)
    // which can briefly re-initialise the Suspense boundary and snap the tab
    // back to the "portfolio" default.  router.replace is a pure URL update;
    // the immediate setActiveTab call keeps the UI snappy.
    onPortfolio: () => {
      setActiveTab("portfolio");
      router.replace("/dashboard?tab=portfolio", { scroll: false });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    onTransfer: () => {
      setActiveTab("market");
      router.replace("/dashboard?tab=market", { scroll: false });
    },
    onLeaderboard: () => setActiveTab("leaderboard"),
    onLive: () => {
      setActiveTab("bracket");
      router.replace("/dashboard?tab=bracket", { scroll: false });
    },
  }).map((item) => {
    if (item.id === "live") {
      return {
        ...item,
        href: undefined, // strip href — navigation handled by router.replace in onClick
        badge: String(liveMatchCount),
        badgeVariant: liveMatchCount > 0 ? "live-active" as const : "live" as const,
      };
    }
    if (item.id === "transfer") {
      return {
        ...item,
        href: undefined, // strip href — navigation handled by router.replace in onClick
        badge: remainingTransfers > 0 ? String(remainingTransfers) : "",
        badgeVariant: "amber" as const,
      };
    }
    if (item.id === "portfolio") {
      return { ...item, href: undefined }; // strip href — navigation handled by router.replace in onClick
    }
    return item;
  });

  // ✅ Drawer hydration: fetch a user's squad via callable (safe cross-user access)
  async function fetchSquadDetails(
    userId: string,
    displayNameFallback: string
  ): Promise<SquadVM> {
    const fn = httpsCallable(functions, "getSquadDetails");
    const res = await fn({ userId });

    const payload = isRecord(res.data) ? res.data : {};

    const featuredRaw = isRecord(payload.featured) ? payload.featured : null;
    const drawnRaw = Array.isArray(payload.drawn) ? payload.drawn : [];

    const featured: SquadTeamVM | null = featuredRaw
      ? {
          id: String(featuredRaw.id ?? featuredRaw.teamId ?? ""),
          name: String(featuredRaw.name ?? "Star Team"),
          group: String(featuredRaw.group ?? ""),
          tier: Number(featuredRaw.tier ?? 4),
          flagUrl: String(featuredRaw.flagUrl ?? ""),
          role: "featured",
          contribution: Number(featuredRaw.contribution ?? 0),
        }
      : null;

    const drawn: SquadTeamVM[] = drawnRaw
      .map((t: unknown) => {
        const team = isRecord(t) ? t : {};
        return {
        id: String(team.id ?? team.teamId ?? ""),
        name: String(team.name ?? "Team"),
        group: String(team.group ?? ""),
        tier: Number(team.tier ?? 4),
        flagUrl: String(team.flagUrl ?? ""),
        role: "drawn" as const,
        contribution: Number(team.contribution ?? 0),
        };
      })
      .filter((t: SquadTeamVM) => Boolean(t.id));

    const payloadTotalScore = Number(payload.totalScore);
    const derivedTotalScore =
      Number(featured?.contribution ?? 0) +
      drawn.reduce(
        (sum, team) => sum + Number(team.contribution ?? 0),
        0
      );

    const callableLooksEmpty = drawn.length === 0 && (!featured || !featured.id);
    if (callableLooksEmpty && uid && userId === uid) {
      const localFeatured: SquadTeamVM | null = featuredTeamId
        ? {
            id: String(featuredTeamId),
            name: String(
              teamsById[String(featuredTeamId)]?.name ?? String(featuredTeamId)
            ),
            group: String(teamsById[String(featuredTeamId)]?.group ?? ""),
            tier: Number(teamsById[String(featuredTeamId)]?.tier ?? 4),
            flagUrl: String(teamsById[String(featuredTeamId)]?.flagUrl ?? ""),
            role: "featured",
            contribution:
              calculateTeamPoints(teamsById[String(featuredTeamId)] ?? null) * 2,
          }
        : null;
      const localDrawn: SquadTeamVM[] = (drawnTeamIds ?? []).slice(0, 5).map((teamId) => {
        const id = String(teamId);
        const team = teamsById[id] ?? null;
        return {
          id,
          name: String(team?.name ?? id),
          group: String(team?.group ?? ""),
          tier: Number(team?.tier ?? 4),
          flagUrl: String(team?.flagUrl ?? ""),
          role: "drawn" as const,
          contribution: calculateTeamPoints(team),
        };
      });

      return {
        userId: uid,
        displayName: String(payload.displayName ?? displayNameFallback),
        totalScore:
          Number(localFeatured?.contribution ?? 0) +
          localDrawn.reduce(
            (sum, team) => sum + Number(team.contribution ?? 0),
            0
          ),
        featured: localFeatured,
        drawn: localDrawn,
      };
    }

    return {
      userId: String(payload.userId ?? userId),
      displayName: String(payload.displayName ?? displayNameFallback),
      totalScore: Number.isFinite(payloadTotalScore)
        ? payloadTotalScore
        : derivedTotalScore,
      featured,
      drawn: drawn.slice(0, 5),
    };
  }

  // Handle team expansion with lazy match data loading
  async function handleTeamExpand(teamKey: string, teamId: string) {
    // Toggle collapse if already expanded
    if (expandedTeam === teamKey) {
      setExpandedTeam(null);
      return;
    }

    // Expand team
    setExpandedTeam(teamKey);

    // Fetch match data if not already loaded
    if (!teamMatchData[teamId]) {
      setTeamMatchData((prev) => ({
        ...prev,
        [teamId]: { recentForm: [], nextMatch: null, loading: true },
      }));

      try {
        const [recentForm, nextMatch] = await Promise.all([
          getTeamRecentForm(teamId),
          getTeamNextMatch(teamId),
        ]);

        setTeamMatchData((prev) => ({
          ...prev,
          [teamId]: { recentForm, nextMatch, loading: false },
        }));
      } catch (error) {
        console.error("[dashboard] Error fetching match data:", error);
        setTeamMatchData((prev) => ({
          ...prev,
          [teamId]: { recentForm: [], nextMatch: null, loading: false },
        }));
      }
    }
  }

  // User's score and rank from leaderboard
  const localDerivedScore = useMemo(() => {
    const featuredPoints = featuredTeamId
      ? calculateTeamPoints(teamsById[String(featuredTeamId)] ?? null) * 2
      : 0;
    const drawnPoints = (drawnTeamIds ?? []).slice(0, 5).reduce((sum, teamId) => {
      return sum + calculateTeamPoints(teamsById[String(teamId)] ?? null);
    }, 0);
    const transferPenaltyPoints = Number(userDocData.transferPenaltyPoints ?? 0);
    return featuredPoints + drawnPoints - transferPenaltyPoints;
  }, [featuredTeamId, drawnTeamIds, teamsById, userDocData]);

  const userStats = useMemo(() => {
    const userDocScore = Number(userDocData.totalScore);
    const fallbackScore =
      Number.isFinite(userDocScore) && userDocScore !== 0
        ? userDocScore
        : localDerivedScore;
    if (!uid || !leaderboardData.length) return { score: fallbackScore, rank: null };
    const userEntry = leaderboardData.find((u) => u.id === uid);
    return {
      score: userEntry?.totalScore ?? fallbackScore,
      rank: userEntry?.rank ?? null,
    };
  }, [uid, leaderboardData, userDocData, localDerivedScore]);

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
          flagUrl:
            typeof team?.flagUrl === "string" && team.flagUrl.trim().length > 0
              ? team.flagUrl
              : undefined,
          tier: typeof team?.tier === "number" ? team.tier : undefined,
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
        flagUrl:
          typeof team?.flagUrl === "string" && team.flagUrl.trim().length > 0
            ? team.flagUrl
            : undefined,
        tier: typeof team?.tier === "number" ? team.tier : undefined,
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

      const payload = isRecord(res.data) ? res.data : {};
      const nextTransfers = Math.max(
        0,
        Number(payload.remainingTransfers ?? remainingTransfers - 1)
      );

      const refreshedUserSnap = await getDoc(doc(db, "users", uid));
      if (refreshedUserSnap.exists()) {
        setUserDoc(refreshedUserSnap.data() as User);
      }

      setTransferSuccess(
        payload.leaderboardRecomputed === false
          ? `Transfer completed. ${nextTransfers} transfer${nextTransfers === 1 ? "" : "s"} remaining. Leaderboard refresh pending.`
          : `Transfer completed. ${nextTransfers} transfer${nextTransfers === 1 ? "" : "s"} remaining.`
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
      <div className="min-h-screen bg-[var(--ff-bg-app)] text-[var(--ff-fg-primary)] selection:bg-primary/20 pb-[calc(62px+env(safe-area-inset-bottom)+12px)]">
        {ingestHealth.scoresDirty && (
          <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
            <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Live scores updated. Leaderboard refresh pending.
              {ingestHealth.dirtyReason ? ` (${ingestHealth.dirtyReason})` : ""}
            </div>
          </div>
        )}
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 border-b border-[var(--ff-hairline)] bg-[var(--ff-bg-chrome)] text-[var(--ff-fg-primary)]">
          <div className="pt-safe">
            <FeaturedFiveTopBar
              className="mx-auto max-w-6xl px-4"
              brand={
                <AppBrandBlock
                  variant="ff-chrome"
                  title={BRANDING.shortName}
                />
              }
              liveCount={liveMatchCount}
              userDisplayName={topBarDisplayName}
              userEmail={null}
              showUserTile={signedIn && !checkingAuth && !loadingUser}
              onSetDisplayName={signedIn && !loadingUser && !userHasUsername ? () => setUsernameModalOpen(true) : undefined}
              trailing={<AppOverflowMenuButton />}
            />
          </div>
        </header>

        {/* Main */}
        <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Username banner — shown until user sets a display name or dismisses for session */}
        {signedIn && !loadingUser && !userHasUsername && (
          <>
            {!usernameBannerDismissed && (
              <div className="mb-4">
                <UsernameBanner
                  defaultValue={displayName}
                  onSave={handleSetUsername}
                  onDismiss={() => setUsernameBannerDismissed(true)}
                />
              </div>
            )}
            {/* Modal-only instance — triggered via top bar after banner is dismissed */}
            {usernameBannerDismissed && usernameModalOpen && (
              <UsernameBanner
                defaultValue={displayName}
                onSave={handleSetUsername}
                onDismiss={() => setUsernameModalOpen(false)}
                forceOpen={usernameModalOpen}
                onForceOpenChange={(open) => setUsernameModalOpen(open)}
                hideBanner
              />
            )}
          </>
        )}
        {/* Status / errors */}
        {error && (
          <div className="mb-4 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive">
            {error}
          </div>
        )}
        {status && (
          <div className="mb-4 text-sm text-[var(--ff-fg-secondary)]">{status}</div>
        )}

        {/* Portfolio View - Show when on "My Teams" tab */}
        {signedIn && activeTab === "portfolio" && (
          <DashboardPortfolio
            userId={uid}
            userStats={userStats}
            leaderboardCount={leaderboardData.length}
            teamStats={teamStats}
            featuredDisplay={featuredDisplay}
            drawnDisplay={drawnDisplay}
            expandedTeam={expandedTeam}
            teamMatchData={teamMatchData}
            teamsById={teamsById}
            allTeamNames={matchTeamNames}
            onTeamExpand={handleTeamExpand}
            calculateTeamPoints={calculateTeamPoints}
          />
        )}

        {/* Tab content area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          {activeTab === "leaderboard" && (
            <LeaderboardPanel
              data={leaderboardData}
              isLoading={loadingLeaderboard}
              fetchSquad={fetchSquadDetails}
              currentUserId={uid}
            />
          )}
          {activeTab === "bracket" && (
            <DashboardBracket
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
            <DashboardTransferMarket
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
    <React.Suspense fallback={<DashboardSuspenseFallback />}>
      <DashboardPageContent />
    </React.Suspense>
  );
}
