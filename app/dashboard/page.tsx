"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";

import { AppShellV0 } from "@/components/app-shell-v0";
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

const LeaderboardPanel = dynamic(
  () => import("@/components/leaderboard/LeaderboardPanel"),
  { ssr: false, loading: () => <TabPanelLoading /> }
);

const DashboardBracket = dynamic(
  () => import("@/components/dashboard/DashboardBracket"),
  { ssr: false, loading: () => <TabPanelLoading /> }
);

const DashboardTransferMarket = dynamic(
  () => import("@/components/dashboard/DashboardTransferMarket"),
  { ssr: false, loading: () => <TabPanelLoading /> }
);

const DashboardPortfolio = dynamic(
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
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
  const department: Department | null =
    userDocData.department === "Primary" ||
    userDocData.department === "Secondary" ||
    userDocData.department === "Admin"
      ? userDocData.department
      : null;

  const activeNavId = useMemo(() => {
    if (activeTab === "portfolio") return "portfolio";
    if (activeTab === "market") return "transfer";
    if (activeTab === "bracket") return "live";
    if (activeTab === "leaderboard") return "leaderboard";
    return "portfolio";
  }, [activeTab]);

  const navItems = buildMainNavItems({
    signedIn,
    authBusy: checkingAuth || authBusy,
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
        setError(`[users] ${friendlyErrorMessage(e, "Failed to load your entry.")}`);
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

  // Reveal gate - redirect to reveal screen if user hasn't seen it yet
  useEffect(() => {
    if (!signedIn) return;
    if (loadingUser) return;
    if (!userDoc) return;

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
          setError(`[teams] ${friendlyErrorMessage(e, "Failed to load team details.")}`);
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
            return {
            id: String(row.userId ?? row.id ?? ""),
            rank: Number(row.rank ?? idx + 1),
            name: String(row.displayName ?? row.name ?? "Anonymous"),
            totalScore: Number(row.totalScore ?? 0),
            badgeCount: Number(row.badgeCount ?? 0),
            department: typeof row.department === "string" ? row.department : null,
            dept: typeof row.dept === "string" ? row.dept : null,
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
          const data = docSnap.data() as Record<string, unknown>;
          const stage = String(data.stage ?? "GROUP");
          const kickoffTime =
            typeof data.kickoffTime === "string" ? data.kickoffTime : "";
          const updatedAt = toIsoString(data.lastUpdated);

          const home = String(data.homeTeamId ?? "TBD");
          const away = String(data.awayTeamId ?? "TBD");

          if (home && home !== "TBD") teamIds.add(home);
          if (away && away !== "TBD") teamIds.add(away);

          const s1 =
            typeof data.homeScore === "number" ? data.homeScore : undefined;
          const s2 =
            typeof data.awayScore === "number" ? data.awayScore : undefined;

          const statusRaw = String(data.status ?? "SCHEDULED");
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
        const next: Record<string, TeamRecord> = {};
        snap.forEach((docSnap) => {
          next[docSnap.id] = {
            id: docSnap.id,
            ...(docSnap.data() as Record<string, unknown>),
          };
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
    if (authBusy) return;

    setError("");
    setStatus("");
    setAuthBusy(true);
    try {
      setStatus("Opening Google sign-in...");
      const mode = await signInWithGoogle(auth);
      if (mode === "redirect") {
        setStatus("Redirecting to Google sign-in...");
        return;
      }
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
          name: String(featuredRaw.name ?? "Featured"),
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
  const userStats = useMemo(() => {
    const fallbackScore = Number(userDocData.totalScore ?? 0);
    if (!uid || !leaderboardData.length) return { score: fallbackScore, rank: null };
    const userEntry = leaderboardData.find((u) => u.id === uid);
    return {
      score: userEntry?.totalScore ?? fallbackScore,
      rank: userEntry?.rank ?? null,
    };
  }, [uid, leaderboardData, userDocData]);

  const remainingTransfers = Math.max(
    0,
    Number(userDocData.remainingTransfers ?? 0)
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
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.style.display = "none";
                  }}
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
          <DashboardPortfolio
            userStats={userStats}
            leaderboardCount={leaderboardData.length}
            teamStats={teamStats}
            featuredDisplay={featuredDisplay}
            drawnDisplay={drawnDisplay}
            expandedTeam={expandedTeam}
            teamMatchData={teamMatchData}
            teamsById={teamsById}
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
              modeLabel="v0 layout active"
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
