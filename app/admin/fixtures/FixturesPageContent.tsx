"use client";

import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { AdminEnvironmentBadge } from "@/components/admin/AdminEnvironmentBadge";
import { AdminGate } from "@/components/admin/AdminGate";
import { LocalhostProductionWarning } from "@/components/admin/LocalhostProductionWarning";
import { db, functions } from "@/lib/firebase";

function FixtureIngestContent(props: { uid: string }) {
  const { uid } = props;
  type LiveOpsProvider = "stub" | "fixture" | "football-data" | "sportmonks";
  type LiveOpsMode = "disabled" | "shadow" | "staging" | "production";
  type LiveOpsRun = {
    at: string;
    status: "success" | "error";
    provider: LiveOpsProvider;
    matches: number;
    updated: number;
    errorMessage?: string;
  };
  type LiveOpsState = {
    enabled: boolean;
    mode: LiveOpsMode;
    provider: LiveOpsProvider;
    fixtureMaxMatches: number;
    fixtureCutoffIso: string;
    updatedBy?: string;
    updatedAt?: string;
    lastSuccessAt?: string;
    lastErrorAt?: string;
    lastErrorMessage?: string;
    lastRunAt?: string;
    lastRunStatus?: "success" | "error";
    lastRunProvider?: LiveOpsProvider;
    lastRunMatches?: number;
    lastRunUpdated?: number;
    consecutiveFailures?: number;
    recentRuns?: LiveOpsRun[];
  };

  type TransferWindowState = {
    enabled: boolean;
    startsAtIso: string;
    endsAtIso: string;
    updatedBy?: string;
    updatedAt?: string;
  };

  const DEFAULT_LIVE_OPS: LiveOpsState = {
    enabled: false,
    mode: "disabled",
    provider: "fixture",
    fixtureMaxMatches: 0,
    fixtureCutoffIso: "",
    consecutiveFailures: 0,
    recentRuns: [],
  };

  const DEFAULT_TRANSFER_WINDOW: TransferWindowState = {
    enabled: false,
    startsAtIso: "",
    endsAtIso: "",
  };

  type IngestAlertLevel = "healthy" | "warning" | "critical";
  type IngestAlert = {
    level: IngestAlertLevel;
    label: "Healthy" | "Warning" | "Critical";
    message: string;
    stale: boolean;
  };

  const SCHEDULER_INTERVAL_MINUTES = 10;
  const STALE_AFTER_MINUTES = SCHEDULER_INTERVAL_MINUTES * 3;

  type FirestoreTimestampLike = {
    toDate: () => Date;
  };

  type FixtureSelectionPayload = {
    maxMatches?: number;
    cutoffIso?: string;
  };

  type FixtureIngestPayload = FixtureSelectionPayload & {
    dryRun?: boolean;
  };

  type IngestResult = {
    matches?: number;
    updated?: number;
    quarantined?: number;
    provider?: string;
    target?: string;
    leaderboardTarget?: string;
  };

  type ResetPreviewResult = {
    willDelete?: number;
    willIngest?: number;
  };

  type ResetResult = {
    deletedFixtureMatches?: number;
    matches?: number;
    updated?: number;
  };

  type RecomputeResult = {
    users?: number;
    matches?: number;
    wasDirty?: boolean;
    dirtyReason?: string | null;
    retried?: boolean;
    target?: string;
  };

  type LeaderboardRowStatus = {
    userId: string;
    displayName: string;
    totalScore: number;
    rank: number;
  };

  type LeaderboardStatus = {
    lastUpdated?: string;
    scoringVersion?: string;
    includeLive?: boolean;
    rows?: LeaderboardRowStatus[];
  };

  type ReplayResult = {
    applied?: number;
    matches?: number;
    quarantined?: number;
    cursor?: number;
    nextCursor?: number;
    total?: number;
    done?: boolean;
    deleted?: number;
  };

  type PublicRehearsalResetPreview = {
    willDeleteMatches?: number;
    willDeleteTransferEvents?: number;
    willResetUsers?: number;
    willResetTeams?: number;
    willDeleteLeaderboard?: boolean;
  };

  type PublicRehearsalResetResult = {
    deletedMatches?: number;
    deletedTransferEvents?: number;
    resetUsers?: number;
    resetTeams?: number;
    deletedLeaderboard?: boolean;
  };

  type LiveSimulatorResult = {
    waveIndex?: number;
    label?: string;
    totalWaves?: number;
    nextWave?: number;
    done?: boolean;
    matches?: number;
    updated?: number;
    quarantined?: number;
  };

  type LiveSimulatorState = {
    nextWave: number;
    totalWaves: number;
    lastAppliedWave?: number | null;
    lastLabel?: string | null;
    done: boolean;
    updatedAt?: string;
    updatedBy?: string;
  };

  type FixtureReplayState = {
    cursor: number;
    waveSize?: number | null;
    total?: number | null;
    done: boolean;
    shadowMatchCount: number;
  };

  type IngestHealthState = {
    lastIngestAttemptAt?: string;
    lastIngestSuccessAt?: string;
    lastIngestErrorAt?: string;
    lastIngestErrorMessage?: string;
    lastRecomputeAttemptAt?: string;
    lastRecomputeSuccessAt?: string;
    lastRecomputeErrorAt?: string;
    lastRecomputeErrorMessage?: string;
    scoresDirty: boolean;
    dirtyReason?: string | null;
    activeProvider?: string;
    mode?: string | null;
  };

  type ShadowLeaderboardStatus = {
    lastUpdated?: string;
    lastAttemptAt?: string;
    scoringVersion?: string;
    includeLive?: boolean;
    rows?: LeaderboardRowStatus[];
    updatedBy?: string;
    rowCount?: number;
    sourceCollection?: string;
    target?: string;
    lastErrorAt?: string;
    lastErrorMessage?: string;
  };

  type SetLiveOpsSettingsPayload = {
    mode: LiveOpsMode;
    provider: LiveOpsProvider;
    fixtureMaxMatches: number;
    fixtureCutoffIso: string | null;
  };

  function asLiveOpsMode(value: unknown): LiveOpsMode | null {
    return value === "disabled" ||
      value === "shadow" ||
      value === "staging" ||
      value === "production"
      ? value
      : null;
  }

  function getLiveOpsModeMeta(mode: LiveOpsMode) {
    if (mode === "production") {
      return {
        badge: "PRODUCTION",
        classes: "border-rose-500/50 bg-rose-500/15 text-rose-200",
        description: "Writes to public matches and recomputes the public leaderboard.",
      };
    }

    if (mode === "shadow") {
      return {
        badge: "SHADOW",
        classes: "border-amber-500/50 bg-amber-500/15 text-amber-200",
        description: "Writes to shadowMatches only. Public scores stay untouched.",
      };
    }

    if (mode === "staging") {
      return {
        badge: "STAGING",
        classes: "border-sky-500/50 bg-sky-500/15 text-sky-200",
        description: "Uses the safe shadow write path with staging labeling for rehearsal runs.",
      };
    }

    return {
      badge: "DISABLED",
      classes: "border-slate-700/70 bg-slate-900/70 text-slate-300",
      description: "Scheduler is off and manual ingest is blocked until a mode is selected.",
    };
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  function isTimestampLike(value: unknown): value is FirestoreTimestampLike {
    return isRecord(value) && typeof value.toDate === "function";
  }

  function toMillisOrNull(value?: string): number | null {
    if (!value || typeof value !== "string") return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function toIsoOrEmpty(value: unknown): string {
    if (!isTimestampLike(value)) return "";
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime())
      ? date.toISOString()
      : "";
  }

  function toIsoOrString(value: unknown): string {
    const iso = toIsoOrEmpty(value);
    if (iso) return iso;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
    }
    return "";
  }

  function toLocalDateTimeInput(iso: string): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return [
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    ].join("T");
  }

  function fromLocalDateTimeInput(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function asErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error.trim().length > 0) return error;
    return String(error);
  }

  function asNonNegativeInt(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  function buildIngestAlert(state: LiveOpsState): IngestAlert {
    if (state.mode === "disabled") {
      return {
        level: "healthy",
        label: "Healthy",
        message: "Automation is disabled (cost-safe mode).",
        stale: false,
      };
    }

    const failures = Math.max(0, Number(state.consecutiveFailures ?? 0));
    const lastRunMs = toMillisOrNull(state.lastRunAt);
    const stale =
      lastRunMs === null ||
      Date.now() - lastRunMs > STALE_AFTER_MINUTES * 60 * 1000;

    if (failures >= 3 || (stale && failures >= 1)) {
      return {
        level: "critical",
        label: "Critical",
        message: stale
          ? `Scheduler appears stale and has ${failures} consecutive failure(s).`
          : `Scheduler has ${failures} consecutive failures.`,
        stale,
      };
    }

    if (state.lastRunStatus === "error" || failures >= 1 || stale) {
      if (stale && lastRunMs === null) {
        return {
          level: "warning",
          label: "Warning",
          message: `Automation is in ${state.mode} mode but no scheduler run has been recorded yet.`,
          stale: true,
        };
      }

      return {
        level: "warning",
        label: "Warning",
        message: stale
          ? `No run in the last ${STALE_AFTER_MINUTES} minutes.`
          : "Latest scheduler run reported an error.",
        stale,
      };
    }

    return {
      level: "healthy",
      label: "Healthy",
      message: "Latest scheduler run succeeded and health is stable.",
      stale: false,
    };
  }

  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [resetPreview, setResetPreview] = useState("");
  const [maxMatches, setMaxMatches] = useState("");
  const [cutoffIso, setCutoffIso] = useState("");
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [resetRunning, setResetRunning] = useState(false);
  const [resetPreviewing, setResetPreviewing] = useState(false);
  const [preTournamentRunning, setPreTournamentRunning] = useState(false);
  const [preTournamentPreviewing, setPreTournamentPreviewing] = useState(false);
  const [preTournamentStatus, setPreTournamentStatus] = useState("");
  const [preTournamentPreview, setPreTournamentPreview] = useState("");
  const [providerContractRunning, setProviderContractRunning] = useState(false);
  const [providerContractPreviewing, setProviderContractPreviewing] = useState(false);
  const [providerContractStatus, setProviderContractStatus] = useState("");
  const [providerContractPreview, setProviderContractPreview] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [replayWaveSize, setReplayWaveSize] = useState("4");
  const [replayStatus, setReplayStatus] = useState("");
  const [runningReplay, setRunningReplay] = useState(false);
  const [resettingReplay, setResettingReplay] = useState(false);
  const [resettingPublicRehearsal, setResettingPublicRehearsal] =
    useState(false);
  const [previewingPublicRehearsalReset, setPreviewingPublicRehearsalReset] =
    useState(false);
  const [publicRehearsalStatus, setPublicRehearsalStatus] = useState("");
  const [runningLiveSimulatorWave, setRunningLiveSimulatorWave] =
    useState(false);
  const [liveSimulatorStatus, setLiveSimulatorStatus] = useState("");
  const [liveSimulatorState, setLiveSimulatorState] =
    useState<LiveSimulatorState>({
      nextWave: 0,
      totalWaves: 4,
      done: false,
    });
  const [leaderboardStatus, setLeaderboardStatus] = useState<LeaderboardStatus>({});
  const [shadowLeaderboardStatus, setShadowLeaderboardStatus] =
    useState<ShadowLeaderboardStatus>({});
  const [ingestHealth, setIngestHealth] = useState<IngestHealthState>({
    scoresDirty: false,
  });
  const [fixtureReplayState, setFixtureReplayState] = useState<FixtureReplayState>({
    cursor: 0,
    done: false,
    shadowMatchCount: 0,
  });
  const [recomputeStatus, setRecomputeStatus] = useState("");
  const [recomputing, setRecomputing] = useState(false);
  const [retryingDirtyRecompute, setRetryingDirtyRecompute] = useState(false);
  const [recomputingShadow, setRecomputingShadow] = useState(false);
  const [liveOpsStatus, setLiveOpsStatus] = useState("");
  const [savingLiveOps, setSavingLiveOps] = useState(false);
  const [liveOps, setLiveOps] = useState<LiveOpsState>(DEFAULT_LIVE_OPS);
  const [liveOpsModeInput, setLiveOpsModeInput] = useState<LiveOpsMode>("disabled");
  const [liveOpsProviderInput, setLiveOpsProviderInput] =
    useState<LiveOpsProvider>("fixture");
  const [liveOpsMaxInput, setLiveOpsMaxInput] = useState("");
  const [liveOpsCutoffInput, setLiveOpsCutoffInput] = useState("");
  const [transferWindow, setTransferWindow] = useState<TransferWindowState>(
    DEFAULT_TRANSFER_WINDOW
  );
  const [transferWindowEnabledInput, setTransferWindowEnabledInput] =
    useState(false);
  const [transferWindowStartsInput, setTransferWindowStartsInput] =
    useState("");
  const [transferWindowEndsInput, setTransferWindowEndsInput] = useState("");
  const [transferWindowStatus, setTransferWindowStatus] = useState("");
  const [savingTransferWindow, setSavingTransferWindow] = useState(false);
  const [dangerConfirmed, setDangerConfirmed] = useState(false);

  const ingestAlert = buildIngestAlert(liveOps);
  const liveOpsModeMeta = getLiveOpsModeMeta(liveOps.mode);

  function readLeaderboardRows(data: Record<string, unknown>): LeaderboardRowStatus[] {
    const rawRows = Array.isArray(data.rows) ? data.rows : [];
    return rawRows
      .map((row: unknown): LeaderboardRowStatus | null => {
        if (!isRecord(row)) return null;
        const userId =
          typeof row.userId === "string" && row.userId.trim().length > 0
            ? row.userId
            : null;
        const displayName =
          typeof row.displayName === "string" && row.displayName.trim().length > 0
            ? row.displayName
            : null;
        const totalScore =
          typeof row.totalScore === "number" && Number.isFinite(row.totalScore)
            ? row.totalScore
            : null;
        const rank =
          typeof row.rank === "number" && Number.isFinite(row.rank)
            ? Math.max(0, Math.floor(row.rank))
            : null;
        if (!userId || !displayName || totalScore === null || rank === null) {
          return null;
        }
        return { userId, displayName, totalScore, rank };
      })
      .filter((row): row is LeaderboardRowStatus => row !== null);
  }

  function buildLeaderboardDiff() {
    const publicRows = leaderboardStatus.rows ?? [];
    const shadowRows = shadowLeaderboardStatus.rows ?? [];
    const publicByUser = new Map(publicRows.map((row) => [row.userId, row]));
    const shadowByUser = new Map(shadowRows.map((row) => [row.userId, row]));
    const userIds = new Set([...publicByUser.keys(), ...shadowByUser.keys()]);
    const mismatches: Array<{
      userId: string;
      displayName: string;
      publicRank: number | null;
      shadowRank: number | null;
      publicScore: number | null;
      shadowScore: number | null;
    }> = [];

    userIds.forEach((userId) => {
      const publicRow = publicByUser.get(userId);
      const shadowRow = shadowByUser.get(userId);
      const publicRank = publicRow?.rank ?? null;
      const shadowRank = shadowRow?.rank ?? null;
      const publicScore = publicRow?.totalScore ?? null;
      const shadowScore = shadowRow?.totalScore ?? null;
      if (publicRank === shadowRank && publicScore === shadowScore) {
        return;
      }
      mismatches.push({
        userId,
        displayName:
          publicRow?.displayName ?? shadowRow?.displayName ?? userId,
        publicRank,
        shadowRank,
        publicScore,
        shadowScore,
      });
    });

    mismatches.sort((a, b) => {
      const aDelta = Math.abs((a.publicScore ?? 0) - (a.shadowScore ?? 0));
      const bDelta = Math.abs((b.publicScore ?? 0) - (b.shadowScore ?? 0));
      if (bDelta !== aDelta) return bDelta - aDelta;
      return a.displayName.localeCompare(b.displayName);
    });

    return {
      publicCount: publicRows.length,
      shadowCount: shadowRows.length,
      mismatchCount: mismatches.length,
      topMismatches: mismatches.slice(0, 5),
    };
  }

  const leaderboardDiff = buildLeaderboardDiff();

  useEffect(() => {
    if (!uid) {
      setLeaderboardStatus({});
      setShadowLeaderboardStatus({});
      return;
    }

    const ref = doc(db, "leaderboard", "current");
    const shadowRef = doc(db, "shadowLeaderboard", "current");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLeaderboardStatus({});
      } else {
        const data = snap.data() as Record<string, unknown>;
        const updated = toIsoOrEmpty(data.lastUpdated);

        setLeaderboardStatus({
          lastUpdated: updated,
          scoringVersion:
            typeof data.scoringVersion === "string" ? data.scoringVersion : undefined,
          includeLive:
            typeof data.includeLive === "boolean" ? data.includeLive : undefined,
          rows: readLeaderboardRows(data),
        });
      }
    });

    const unsubShadow = onSnapshot(shadowRef, (snap) => {
      if (!snap.exists()) {
        setShadowLeaderboardStatus({});
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      setShadowLeaderboardStatus({
        lastUpdated: toIsoOrString(data.lastUpdated),
        lastAttemptAt: toIsoOrString(data.lastAttemptAt),
        scoringVersion:
          typeof data.scoringVersion === "string" ? data.scoringVersion : undefined,
        includeLive:
          typeof data.includeLive === "boolean" ? data.includeLive : undefined,
        rows: readLeaderboardRows(data),
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : undefined,
        rowCount:
          typeof data.rowCount === "number" && Number.isFinite(data.rowCount)
            ? Math.max(0, Math.floor(data.rowCount))
            : undefined,
        sourceCollection:
          typeof data.sourceCollection === "string"
            ? data.sourceCollection
            : undefined,
        target: typeof data.target === "string" ? data.target : undefined,
        lastErrorAt: toIsoOrString(data.lastErrorAt),
        lastErrorMessage:
          typeof data.lastErrorMessage === "string"
            ? data.lastErrorMessage
            : undefined,
      });
    });

    return () => {
      unsub();
      unsubShadow();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setIngestHealth({ scoresDirty: false });
      return;
    }

    const ref = doc(db, "ingestHealth", "current");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setIngestHealth({ scoresDirty: false });
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      setIngestHealth({
        lastIngestAttemptAt: toIsoOrString(data.lastIngestAttemptAt),
        lastIngestSuccessAt: toIsoOrString(data.lastIngestSuccessAt),
        lastIngestErrorAt: toIsoOrString(data.lastIngestErrorAt),
        lastIngestErrorMessage:
          typeof data.lastIngestErrorMessage === "string"
            ? data.lastIngestErrorMessage
            : "",
        lastRecomputeAttemptAt: toIsoOrString(data.lastRecomputeAttemptAt),
        lastRecomputeSuccessAt: toIsoOrString(data.lastRecomputeSuccessAt),
        lastRecomputeErrorAt: toIsoOrString(data.lastRecomputeErrorAt),
        lastRecomputeErrorMessage:
          typeof data.lastRecomputeErrorMessage === "string"
            ? data.lastRecomputeErrorMessage
            : "",
        scoresDirty: data.scoresDirty === true,
        dirtyReason:
          typeof data.dirtyReason === "string" ? data.dirtyReason : null,
        activeProvider:
          typeof data.activeProvider === "string" ? data.activeProvider : "",
        mode: typeof data.mode === "string" ? data.mode : null,
      });
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setFixtureReplayState({
        cursor: 0,
        done: false,
        shadowMatchCount: 0,
      });
      return;
    }

    const replayRef = doc(db, "settings", "fixtureReplay");
    const shadowMatchesRef = collection(db, "shadowMatches");

    const unsubReplay = onSnapshot(replayRef, (snap) => {
      const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
      setFixtureReplayState((prev) => ({
        ...prev,
        cursor:
          typeof data.cursor === "number" && Number.isFinite(data.cursor)
            ? Math.max(0, Math.floor(data.cursor))
            : 0,
        waveSize:
          typeof data.waveSize === "number" && Number.isFinite(data.waveSize)
            ? Math.max(1, Math.floor(data.waveSize))
            : null,
        total:
          typeof data.total === "number" && Number.isFinite(data.total)
            ? Math.max(0, Math.floor(data.total))
            : null,
        done: data.done === true,
      }));
    });

    const unsubShadow = onSnapshot(shadowMatchesRef, (snap) => {
      setFixtureReplayState((prev) => ({
        ...prev,
        shadowMatchCount: snap.size,
      }));
    });

    return () => {
      unsubReplay();
      unsubShadow();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setLiveSimulatorState({
        nextWave: 0,
        totalWaves: 4,
        done: false,
      });
      return;
    }

    const ref = doc(db, "settings", "liveSimulator");
    const unsub = onSnapshot(ref, (snap) => {
      const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
      setLiveSimulatorState({
        nextWave:
          typeof data.nextWave === "number" && Number.isFinite(data.nextWave)
            ? Math.max(0, Math.floor(data.nextWave))
            : 0,
        totalWaves:
          typeof data.totalWaves === "number" && Number.isFinite(data.totalWaves)
            ? Math.max(1, Math.floor(data.totalWaves))
            : 4,
        lastAppliedWave:
          typeof data.lastAppliedWave === "number" &&
          Number.isFinite(data.lastAppliedWave)
            ? Math.max(0, Math.floor(data.lastAppliedWave))
            : null,
        lastLabel:
          typeof data.lastLabel === "string" && data.lastLabel.trim().length > 0
            ? data.lastLabel
            : null,
        done: data.done === true,
        updatedAt: toIsoOrString(data.updatedAt),
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
      });
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setLiveOps(DEFAULT_LIVE_OPS);
      setLiveOpsModeInput("disabled");
      setLiveOpsProviderInput("fixture");
      setLiveOpsMaxInput("");
      setLiveOpsCutoffInput("");
      return;
    }

    const ref = doc(db, "settings", "liveOps");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLiveOps(DEFAULT_LIVE_OPS);
        setLiveOpsModeInput("disabled");
        setLiveOpsProviderInput("fixture");
        setLiveOpsMaxInput("");
        setLiveOpsCutoffInput("");
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const provider =
        data.provider === "stub" ||
        data.provider === "fixture" ||
        data.provider === "football-data" ||
        data.provider === "sportmonks" ||
        data.provider === "provider"
          ? data.provider
          : "fixture";
      const normalizedProvider =
        provider === "provider" ? "football-data" : provider;
      const mode =
        asLiveOpsMode(data.mode) ??
        (data.enabled === true ? "production" : "disabled");
      const maxMatches =
        typeof data.fixtureMaxMatches === "number" && data.fixtureMaxMatches > 0
          ? Math.floor(data.fixtureMaxMatches)
          : 0;
      const cutoffIso =
        typeof data.fixtureCutoffIso === "string" ? data.fixtureCutoffIso : "";
      const updated = toIsoOrEmpty(data.updatedAt);
      const lastSuccessAt = toIsoOrEmpty(data.lastSuccessAt);
      const lastErrorAt = toIsoOrEmpty(data.lastErrorAt);
      const lastErrorMessage =
        typeof data.lastErrorMessage === "string" ? data.lastErrorMessage : "";
      const lastRunAt =
        toIsoOrEmpty(data.lastRunAt) ||
        (typeof data.lastRunAtIso === "string" ? data.lastRunAtIso : "");
      const lastRunStatus =
        data.lastRunStatus === "success" || data.lastRunStatus === "error"
          ? data.lastRunStatus
          : undefined;
      const lastRunProvider =
        data.lastRunProvider === "stub" ||
        data.lastRunProvider === "fixture" ||
        data.lastRunProvider === "football-data" ||
        data.lastRunProvider === "sportmonks" ||
        data.lastRunProvider === "provider"
          ? data.lastRunProvider === "provider"
            ? "football-data"
            : data.lastRunProvider
          : undefined;
      const lastRunMatches = asNonNegativeInt(data.lastRunMatches);
      const lastRunUpdated = asNonNegativeInt(data.lastRunUpdated);
      const consecutiveFailures = asNonNegativeInt(data.consecutiveFailures);

      const recentRuns: LiveOpsRun[] = Array.isArray(data.recentRuns)
        ? data.recentRuns
            .map((run: unknown): LiveOpsRun | null => {
              if (!isRecord(run)) return null;
              const at =
                typeof run.at === "string" && run.at.trim().length > 0
                  ? run.at
                  : "";
              const status =
                run.status === "success" || run.status === "error"
                  ? run.status
                  : null;
              const provider =
                run.provider === "stub" ||
                run.provider === "fixture" ||
                run.provider === "football-data" ||
                run.provider === "sportmonks" ||
                run.provider === "provider"
                  ? run.provider === "provider"
                    ? "football-data"
                    : run.provider
                  : null;
              if (!at || !status || !provider) return null;

              return {
                at,
                status,
                provider,
                matches: asNonNegativeInt(run.matches),
                updated: asNonNegativeInt(run.updated),
                errorMessage:
                  typeof run.errorMessage === "string"
                    ? run.errorMessage
                    : undefined,
              };
            })
            .filter((run): run is LiveOpsRun => run !== null)
            .slice(0, 12)
        : [];

      const nextState: LiveOpsState = {
        enabled: mode !== "disabled",
        mode,
        provider: normalizedProvider,
        fixtureMaxMatches: maxMatches,
        fixtureCutoffIso: cutoffIso,
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
        updatedAt: updated,
        lastSuccessAt,
        lastErrorAt,
        lastErrorMessage,
        lastRunAt,
        lastRunStatus,
        lastRunProvider,
        lastRunMatches,
        lastRunUpdated,
        consecutiveFailures,
        recentRuns,
      };

      setLiveOps(nextState);
      setLiveOpsModeInput(nextState.mode);
      setLiveOpsProviderInput(nextState.provider);
      setLiveOpsMaxInput(
        nextState.fixtureMaxMatches > 0 ? String(nextState.fixtureMaxMatches) : ""
      );
      setLiveOpsCutoffInput(nextState.fixtureCutoffIso);
    });

    return () => unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setTransferWindow(DEFAULT_TRANSFER_WINDOW);
      setTransferWindowEnabledInput(false);
      setTransferWindowStartsInput("");
      setTransferWindowEndsInput("");
      return;
    }

    const ref = doc(db, "settings", "transferWindow");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setTransferWindow(DEFAULT_TRANSFER_WINDOW);
        setTransferWindowEnabledInput(false);
        setTransferWindowStartsInput("");
        setTransferWindowEndsInput("");
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const startsAtIso = toIsoOrString(data.startsAt);
      const endsAtIso = toIsoOrString(data.endsAt);
      const nextState: TransferWindowState = {
        enabled: data.enabled === true,
        startsAtIso,
        endsAtIso,
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
        updatedAt: toIsoOrString(data.updatedAt),
      };

      setTransferWindow(nextState);
      setTransferWindowEnabledInput(nextState.enabled);
      setTransferWindowStartsInput(toLocalDateTimeInput(nextState.startsAtIso));
      setTransferWindowEndsInput(toLocalDateTimeInput(nextState.endsAtIso));
    });

    return () => unsub();
  }, [uid]);

  function getFixtureSelection() {
    const max = Number(maxMatches);
    const hasMax = Number.isFinite(max) && max > 0;
    const trimmedCutoff = cutoffIso.trim();
    const hasCutoff = trimmedCutoff.length > 0;
    const payload: { maxMatches?: number; cutoffIso?: string } = {};

    if (hasMax) payload.maxMatches = max;
    if (hasCutoff) payload.cutoffIso = trimmedCutoff;

    return { max, hasMax, hasCutoff, trimmedCutoff, payload };
  }

  async function runFixtureIngest() {
    setStatus("");
    setPreview("");
    setResetStatus("");
    setResetPreview("");
    if (!uid) {
      setStatus("❌ Not signed in.");
      return;
    }

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } =
      getFixtureSelection();
    const summary = [
      "Run fixture ingest?",
      hasMax ? `- maxMatches: ${max}` : "- maxMatches: (all)",
      hasCutoff ? `- cutoffIso: ${trimmedCutoff}` : "- cutoffIso: (none)",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setStatus("Cancelled.");
      return;
    }

    setRunning(true);
    setStatus("Running fixture ingest...");

    try {
      const fn = httpsCallable<FixtureIngestPayload, IngestResult>(
        functions,
        "adminIngestFixture"
      );
      const res = await fn(payload);
      const data = res.data;

      setStatus(
        `✅ Ingested ${data?.matches ?? 0} matches, updated ${data?.updated ?? 0}. ` +
          `Leaderboard recomputed.`
      );
    } catch (err: unknown) {
      console.error(err);
      setStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRunning(false);
    }
  }

  async function previewFixture() {
    setStatus("");
    setPreview("");
    setResetStatus("");
    setResetPreview("");
    if (!uid) {
      setPreview("❌ Not signed in.");
      return;
    }

    setPreviewing(true);
    try {
      const fn = httpsCallable<FixtureIngestPayload, IngestResult>(
        functions,
        "adminIngestFixture"
      );
      const { payload } = getFixtureSelection();
      const dryRunPayload: {
        maxMatches?: number;
        cutoffIso?: string;
        dryRun: true;
      } = {
        dryRun: true,
      };
      if (payload.maxMatches !== undefined) {
        dryRunPayload.maxMatches = payload.maxMatches;
      }
      if (payload.cutoffIso) {
        dryRunPayload.cutoffIso = payload.cutoffIso;
      }

      const res = await fn(dryRunPayload);
      const data = res.data;

      setPreview(`Preview: ${data?.matches ?? 0} matches selected.`);
    } catch (err: unknown) {
      console.error(err);
      setPreview(`❌ ${asErrorMessage(err)}`);
    } finally {
      setPreviewing(false);
    }
  }

  async function previewResetFixture() {
    setResetStatus("");
    setResetPreview("");
    setStatus("");
    if (!uid) {
      setResetPreview("❌ Not signed in.");
      return;
    }

    setResetPreviewing(true);
    try {
      const fn = httpsCallable<FixtureIngestPayload, ResetPreviewResult>(
        functions,
        "adminResetFixtureIngest"
      );
      const { payload } = getFixtureSelection();
      const dryRunPayload: {
        maxMatches?: number;
        cutoffIso?: string;
        dryRun: true;
      } = {
        dryRun: true,
      };

      if (payload.maxMatches !== undefined) {
        dryRunPayload.maxMatches = payload.maxMatches;
      }
      if (payload.cutoffIso) {
        dryRunPayload.cutoffIso = payload.cutoffIso;
      }

      const res = await fn(dryRunPayload);
      const data = res.data;
      setResetPreview(
        `Reset preview: delete ${data?.willDelete ?? 0} fixture matches, then ingest ${data?.willIngest ?? 0} matches.`
      );
    } catch (err: unknown) {
      console.error(err);
      setResetPreview(`❌ ${asErrorMessage(err)}`);
    } finally {
      setResetPreviewing(false);
    }
  }

  async function runResetFixtureIngest() {
    setResetStatus("");
    setResetPreview("");
    setStatus("");
    setPreview("");
    if (!uid) {
      setResetStatus("❌ Not signed in.");
      return;
    }

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } =
      getFixtureSelection();
    const summary = [
      "Reset fixture state and ingest selection?",
      "- Existing fixture matches will be deleted first.",
      hasMax ? `- maxMatches: ${max}` : "- maxMatches: (all)",
      hasCutoff ? `- cutoffIso: ${trimmedCutoff}` : "- cutoffIso: (none)",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setResetStatus("Cancelled.");
      return;
    }

    setResetRunning(true);
    setResetStatus("Resetting fixture matches and ingesting selection...");

    try {
      const fn = httpsCallable<FixtureIngestPayload, ResetResult>(
        functions,
        "adminResetFixtureIngest"
      );
      const res = await fn(payload);
      const data = res.data;
      setResetStatus(
        `✅ Reset deleted ${data?.deletedFixtureMatches ?? 0} fixture matches, ingested ${data?.matches ?? 0}, updated ${data?.updated ?? 0}. Leaderboard recomputed.`
      );
    } catch (err: unknown) {
      console.error(err);
      setResetStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setResetRunning(false);
    }
  }

  async function previewPreTournament() {
    setPreTournamentStatus("");
    setPreTournamentPreview("");
    if (!uid) {
      setPreTournamentPreview("❌ Not authorized.");
      return;
    }

    setPreTournamentPreviewing(true);
    try {
      const fn = httpsCallable<{ dryRun?: boolean }, IngestResult>(
        functions,
        "adminIngestPreTournament"
      );
      const res = await fn({ dryRun: true });
      const data = res.data;
      setPreTournamentPreview(
        `Preview: ${data?.matches ?? 0} pre-tournament matches available.`
      );
    } catch (err: unknown) {
      console.error(err);
      setPreTournamentPreview(`❌ ${asErrorMessage(err)}`);
    } finally {
      setPreTournamentPreviewing(false);
    }
  }

  async function runPreTournamentIngest() {
    setPreTournamentStatus("");
    setPreTournamentPreview("");
    if (!uid) {
      setPreTournamentStatus("❌ Not authorized.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Import pre-tournament match data? This will add historical friendlies and qualifiers."
      )
    ) {
      setPreTournamentStatus("Cancelled.");
      return;
    }

    setPreTournamentRunning(true);
    setPreTournamentStatus("Importing pre-tournament matches...");

    try {
      const fn = httpsCallable<{ dryRun?: boolean }, IngestResult>(
        functions,
        "adminIngestPreTournament"
      );
      const res = await fn({});
      const data = res.data;
      setPreTournamentStatus(
        `✅ Imported ${data?.matches ?? 0} pre-tournament matches, ` +
          `updated ${data?.updated ?? 0}. Leaderboard recomputed.`
      );
    } catch (err: unknown) {
      console.error(err);
      setPreTournamentStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setPreTournamentRunning(false);
    }
  }

  async function previewProviderContractTest() {
    setProviderContractStatus("");
    setProviderContractPreview("");
    if (!uid) {
      setProviderContractPreview("❌ Not authorized.");
      return;
    }

    if (liveOpsProviderInput !== "sportmonks" && liveOpsProviderInput !== "football-data") {
      setProviderContractPreview("❌ Choose Sportmonks or football-data.org for a real-provider contract test.");
      return;
    }

    setProviderContractPreviewing(true);
    try {
      const fn = httpsCallable<
        { provider: LiveOpsProvider; maxMatches?: number; cutoffIso?: string; dryRun?: boolean },
        IngestResult
      >(functions, "adminContractTestProvider");
      const { payload } = getFixtureSelection();
      const res = await fn({
        provider: liveOpsProviderInput,
        maxMatches: payload.maxMatches,
        cutoffIso: payload.cutoffIso,
        dryRun: true,
      });
      const data = res.data;
      setProviderContractPreview(
        `Preview: provider ${data.provider ?? liveOpsProviderInput} returned ${data.matches ?? 0} mapped match(es) for shadow contract test.`
      );
    } catch (err: unknown) {
      console.error(err);
      setProviderContractPreview(`❌ ${asErrorMessage(err)}`);
    } finally {
      setProviderContractPreviewing(false);
    }
  }

  async function runProviderContractTest() {
    setProviderContractStatus("");
    setProviderContractPreview("");
    if (!uid) {
      setProviderContractStatus("❌ Not authorized.");
      return;
    }

    if (liveOpsProviderInput !== "sportmonks" && liveOpsProviderInput !== "football-data") {
      setProviderContractStatus("❌ Choose Sportmonks or football-data.org for a real-provider contract test.");
      return;
    }

    const { max, hasMax, hasCutoff, trimmedCutoff, payload } = getFixtureSelection();
    const summary = [
      `Run provider contract test in shadow mode for ${liveOpsProviderInput}?`,
      "- Writes go to shadowMatches.",
      "- Recompute writes to shadowLeaderboard/current.",
      hasMax ? `- maxMatches: ${max}` : "- maxMatches: (provider default/all)",
      hasCutoff ? `- cutoffIso: ${trimmedCutoff}` : "- cutoffIso: (none)",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setProviderContractStatus("Cancelled.");
      return;
    }

    setProviderContractRunning(true);
    setProviderContractStatus("Running provider contract test into shadow mode...");

    try {
      const fn = httpsCallable<
        { provider: LiveOpsProvider; maxMatches?: number; cutoffIso?: string; dryRun?: boolean },
        IngestResult
      >(functions, "adminContractTestProvider");
      const res = await fn({
        provider: liveOpsProviderInput,
        maxMatches: payload.maxMatches,
        cutoffIso: payload.cutoffIso,
      });
      const data = res.data;
      setProviderContractStatus(
        `✅ ${data.provider ?? liveOpsProviderInput} contract test mapped ${data.matches ?? 0} match(es), updated ${data.updated ?? 0}, quarantined ${data.quarantined ?? 0}, target ${data.target ?? "shadowMatches"}, leaderboard ${data.leaderboardTarget ?? "shadowLeaderboard/current"}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setProviderContractStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setProviderContractRunning(false);
    }
  }

  async function recomputeLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }

    setRecomputing(true);
    setRecomputeStatus("Recomputing leaderboard...");

    try {
      const fn = httpsCallable<
        { includeLive: boolean; scoringVersion: string },
        RecomputeResult
      >(functions, "recomputeScores");
      const res = await fn({ includeLive: true, scoringVersion: "v1" });
      const data = res.data;
      setRecomputeStatus(
        `✅ Recomputed for ${data?.users ?? 0} users (${data?.matches ?? 0} matches).`
      );
    } catch (err: unknown) {
      console.error(err);
      setRecomputeStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRecomputing(false);
    }
  }

  async function retryDirtyLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }

    setRetryingDirtyRecompute(true);
    setRecomputeStatus("Retrying dirty leaderboard recompute...");

    try {
      const fn = httpsCallable<
        { includeLive: boolean; scoringVersion: string },
        RecomputeResult
      >(functions, "retryDirtyRecompute");
      const res = await fn({ includeLive: true, scoringVersion: "v1" });
      const data = res.data;
      const context = data.wasDirty
        ? ` Dirty before retry: yes${data.dirtyReason ? ` (${data.dirtyReason})` : ""}.`
        : " Dirty before retry: no.";
      setRecomputeStatus(
        `✅ Retry recomputed for ${data?.users ?? 0} users (${data?.matches ?? 0} matches).${context}`
      );
    } catch (err: unknown) {
      console.error(err);
      setRecomputeStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRetryingDirtyRecompute(false);
    }
  }

  async function recomputeShadowLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }

    setRecomputingShadow(true);
    setRecomputeStatus("Recomputing shadow leaderboard...");

    try {
      const fn = httpsCallable<
        { includeLive: boolean; scoringVersion: string },
        RecomputeResult
      >(functions, "recomputeShadowScores");
      const res = await fn({ includeLive: true, scoringVersion: "v1" });
      const data = res.data;
      setRecomputeStatus(
        `✅ Shadow recompute processed ${data?.users ?? 0} users (${data?.matches ?? 0} matches) into ${data?.target ?? "shadow"}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setRecomputeStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRecomputingShadow(false);
    }
  }

  async function previewPublicRehearsalReset() {
    setPublicRehearsalStatus("");
    if (!uid) {
      setPublicRehearsalStatus("❌ Not signed in.");
      return;
    }

    setPreviewingPublicRehearsalReset(true);
    try {
      const fn = httpsCallable<
        { dryRun: true },
        PublicRehearsalResetPreview
      >(functions, "adminResetPublicRehearsalState");
      const res = await fn({ dryRun: true });
      const data = res.data;
      setPublicRehearsalStatus(
        `Preview: delete ${data.willDeleteMatches ?? 0} public match(es), delete ${data.willDeleteTransferEvents ?? 0} transfer event(s), reset ${data.willResetUsers ?? 0} user score(s), reset ${data.willResetTeams ?? 0} team stat row(s).`
      );
    } catch (err: unknown) {
      console.error(err);
      setPublicRehearsalStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setPreviewingPublicRehearsalReset(false);
    }
  }

  async function resetPublicRehearsalState() {
    setPublicRehearsalStatus("");
    if (!uid) {
      setPublicRehearsalStatus("❌ Not signed in.");
      return;
    }

    const summary = [
      "Reset visible rehearsal state?",
      "- Users and entries stay.",
      "- Public matches and transfer events are deleted.",
      "- Team stats and user scores return to zero.",
      "- Public leaderboard/current is deleted.",
    ].join("\n");

    if (typeof window !== "undefined" && !window.confirm(summary)) {
      setPublicRehearsalStatus("Cancelled.");
      return;
    }

    setResettingPublicRehearsal(true);
    setPublicRehearsalStatus("Resetting visible rehearsal state...");
    try {
      const fn = httpsCallable<Record<string, never>, PublicRehearsalResetResult>(
        functions,
        "adminResetPublicRehearsalState"
      );
      const res = await fn({});
      const data = res.data;
      setPublicRehearsalStatus(
        `✅ Reset complete. Deleted ${data.deletedMatches ?? 0} match(es) and ${data.deletedTransferEvents ?? 0} transfer event(s). Reset ${data.resetUsers ?? 0} user score(s) and ${data.resetTeams ?? 0} team stat row(s).`
      );
    } catch (err: unknown) {
      console.error(err);
      setPublicRehearsalStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setResettingPublicRehearsal(false);
    }
  }

  async function runLiveSimulatorWave() {
    setLiveSimulatorStatus("");
    if (!uid) {
      setLiveSimulatorStatus("❌ Not signed in.");
      return;
    }

    setRunningLiveSimulatorWave(true);
    setLiveSimulatorStatus("Running next visible live wave...");
    try {
      const fn = httpsCallable<Record<string, never>, LiveSimulatorResult>(
        functions,
        "adminRunLocalLiveSimulatorWave"
      );
      const res = await fn({});
      const data = res.data;
      const label = data.label ? ` (${data.label})` : "";
      setLiveSimulatorStatus(
        `✅ Wave ${(data.waveIndex ?? 0) + 1}/${data.totalWaves ?? 4}${label}: processed ${data.matches ?? 0}, updated ${data.updated ?? 0}, quarantined ${data.quarantined ?? 0}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setLiveSimulatorStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRunningLiveSimulatorWave(false);
    }
  }

  async function runReplayWave() {
    setReplayStatus("");
    if (!uid) {
      setReplayStatus("❌ Not signed in.");
      return;
    }

    const parsed = Number(replayWaveSize);
    const waveSize =
      Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 4;

    setRunningReplay(true);
    setReplayStatus("Running fixture replay wave into shadowMatches...");

    try {
      const fn = httpsCallable<{ waveSize: number }, ReplayResult>(
        functions,
        "adminReplayFixtureWave"
      );
      const res = await fn({ waveSize });
      const data = res.data;
      setReplayStatus(
        `✅ Replay wave applied ${data.applied ?? 0} update(s), processed ${data.matches ?? 0}, quarantined ${data.quarantined ?? 0}. Cursor ${data.nextCursor ?? 0}/${data.total ?? 0}${data.done ? " (done)" : ""}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setReplayStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setRunningReplay(false);
    }
  }

  async function resetReplayShadow() {
    setReplayStatus("");
    if (!uid) {
      setReplayStatus("❌ Not signed in.");
      return;
    }

    setResettingReplay(true);
    setReplayStatus("Resetting shadow replay state...");

    try {
      const fn = httpsCallable<Record<string, never>, ReplayResult>(
        functions,
        "adminResetFixtureReplay"
      );
      const res = await fn({});
      const data = res.data;
      setReplayStatus(
        `✅ Replay shadow reset. Deleted ${data.deleted ?? 0} shadow match document(s). Cursor reset to 0.`
      );
    } catch (err: unknown) {
      console.error(err);
      setReplayStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setResettingReplay(false);
    }
  }

  async function saveLiveOpsSettings() {
    setLiveOpsStatus("");
    if (!uid) {
      setLiveOpsStatus("❌ Not signed in.");
      return;
    }

    const maxRaw = liveOpsMaxInput.trim();
    const maxParsed = maxRaw ? Number(maxRaw) : 0;
    if (maxRaw && (!Number.isFinite(maxParsed) || maxParsed < 0)) {
      setLiveOpsStatus("❌ Max matches must be a non-negative number.");
      return;
    }

    const cutoffTrimmed = liveOpsCutoffInput.trim();

    setSavingLiveOps(true);
    setLiveOpsStatus("Saving automation settings...");

    try {
      const fn = httpsCallable<SetLiveOpsSettingsPayload, unknown>(
        functions,
        "setLiveOpsSettings"
      );
      await fn({
        mode: liveOpsModeInput,
        provider: liveOpsProviderInput,
        fixtureMaxMatches: maxRaw ? Math.floor(maxParsed) : 0,
        fixtureCutoffIso: cutoffTrimmed || null,
      });
      setLiveOpsStatus(
        `✅ Automation saved: ${liveOpsModeInput} mode via ${liveOpsProviderInput}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setLiveOpsStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setSavingLiveOps(false);
    }
  }

  async function saveTransferWindow(options?: {
    enabled?: boolean;
    startsInput?: string;
    endsInput?: string;
  }) {
    setTransferWindowStatus("");
    if (!uid) {
      setTransferWindowStatus("❌ Not signed in.");
      return;
    }

    const enabledValue = options?.enabled ?? transferWindowEnabledInput;
    const startsInputValue = options?.startsInput ?? transferWindowStartsInput;
    const endsInputValue = options?.endsInput ?? transferWindowEndsInput;
    const startsAt = fromLocalDateTimeInput(startsInputValue);
    const endsAt = fromLocalDateTimeInput(endsInputValue);

    if (startsInputValue.trim() && !startsAt) {
      setTransferWindowStatus("❌ Invalid start time.");
      return;
    }
    if (endsInputValue.trim() && !endsAt) {
      setTransferWindowStatus("❌ Invalid end time.");
      return;
    }
    if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
      setTransferWindowStatus("❌ End time must be after start time.");
      return;
    }

    setSavingTransferWindow(true);
    setTransferWindowStatus("Saving transfer window...");

    try {
      await setDoc(
        doc(db, "settings", "transferWindow"),
        {
          enabled: enabledValue,
          startsAt: startsAt ?? null,
          endsAt: endsAt ?? null,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        },
        { merge: true }
      );

      setTransferWindowStatus(
        `✅ Transfer window ${enabledValue ? "enabled" : "disabled"}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setTransferWindowStatus(`❌ ${asErrorMessage(err)}`);
    } finally {
      setSavingTransferWindow(false);
    }
  }

  async function closeTransferWindowNow() {
    setTransferWindowEnabledInput(false);
    setTransferWindowStartsInput("");
    setTransferWindowEndsInput("");
    await saveTransferWindow({
      enabled: false,
      startsInput: "",
      endsInput: "",
    });
  }

  async function openTransferWindowNow() {
    setTransferWindowEnabledInput(true);
    setTransferWindowStartsInput("");
    setTransferWindowEndsInput("");
    await saveTransferWindow({
      enabled: true,
      startsInput: "",
      endsInput: "",
    });
  }

  return (
    <>
      <div className="text-sm text-slate-300">
        Signed in as <strong>{uid}</strong>
      </div>

      <LocalhostProductionWarning onConfirmedChange={setDangerConfirmed} />

              <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100">
                      Live Automation (Scheduler)
                    </div>
                    <div className="text-xs text-slate-400">
                      Default is OFF to keep costs near zero in dev.
                    </div>
                  </div>
                  <div
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${liveOpsModeMeta.classes}`}
                  >
                    {liveOpsModeMeta.badge}
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  {liveOpsModeMeta.description}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm text-slate-300">
                    Mode
                    <select
                      value={liveOpsModeInput}
                      onChange={(e) =>
                        setLiveOpsModeInput(e.target.value as LiveOpsMode)
                      }
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="disabled">Disabled</option>
                      <option value="shadow">Shadow</option>
                      <option value="staging">Staging</option>
                      <option value="production">Production</option>
                    </select>
                  </label>

                  <label className="block text-sm text-slate-300">
                    Provider
                    <select
                      value={liveOpsProviderInput}
                      onChange={(e) =>
                        setLiveOpsProviderInput(e.target.value as LiveOpsProvider)
                      }
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="fixture">Fixture (safe testing)</option>
                      <option value="sportmonks">Sportmonks (trial primary)</option>
                      <option value="football-data">football-data.org (smoke)</option>
                      <option value="stub">Stub (no ingest)</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm text-slate-300">
                    Fixture max matches (optional)
                    <input
                      type="number"
                      min="0"
                      value={liveOpsMaxInput}
                      onChange={(e) => setLiveOpsMaxInput(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                      placeholder="0 = all"
                    />
                  </label>

                  <label className="block text-sm text-slate-300">
                    Fixture cutoff ISO (optional)
                    <input
                      type="text"
                      value={liveOpsCutoffInput}
                      onChange={(e) => setLiveOpsCutoffInput(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                      placeholder="e.g., 2022-11-22T00:00:00Z"
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    onClick={saveLiveOpsSettings}
                    disabled={!uid || savingLiveOps || !dangerConfirmed}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
                  >
                    {savingLiveOps ? "Saving..." : "Save Automation Settings"}
                  </button>
                </div>

                {liveOpsStatus ? (
                  <div className="text-sm text-slate-300">{liveOpsStatus}</div>
                ) : null}

                <div className="border-t border-slate-800/60 pt-3 space-y-2">
                  <div className="font-semibold text-slate-100">
                    Real Provider Contract Test
                  </div>
                  <p className="text-xs text-slate-400">
                    Uses the selected real provider and pushes mapped updates through
                    validation into <code className="mx-1 text-emerald-200/90">shadowMatches</code>,
                    then recomputes <code className="mx-1 text-emerald-200/90">shadowLeaderboard/current</code>.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={previewProviderContractTest}
                      disabled={
                        !uid ||
                        providerContractRunning ||
                        providerContractPreviewing ||
                        !dangerConfirmed
                      }
                      className="w-full sm:w-auto px-4 py-2 rounded-xl border border-sky-500/50 bg-sky-500/10 text-sky-100 font-semibold disabled:opacity-50"
                    >
                      {providerContractPreviewing
                        ? "Previewing Contract Test..."
                        : "Preview Contract Test"}
                    </button>
                    <button
                      onClick={runProviderContractTest}
                      disabled={
                        !uid ||
                        providerContractRunning ||
                        providerContractPreviewing ||
                        !dangerConfirmed
                      }
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-violet-500/90 text-violet-950 font-semibold disabled:opacity-50"
                    >
                      {providerContractRunning
                        ? "Running Contract Test..."
                        : "Run Contract Test in Shadow"}
                    </button>
                  </div>
                  {providerContractPreview ? (
                    <div className="text-sm text-slate-300">{providerContractPreview}</div>
                  ) : null}
                  {providerContractStatus ? (
                    <div className="text-sm text-slate-300">{providerContractStatus}</div>
                  ) : null}
                </div>

                <div className="text-xs text-slate-400">
                  Last update: {liveOps.updatedAt || "—"}{" "}
                  {liveOps.updatedBy ? `• by ${liveOps.updatedBy}` : ""}
                </div>

                <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 p-3 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-slate-100">Ingest Health</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                        ingestAlert.level === "critical"
                          ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                          : ingestAlert.level === "warning"
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                          : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                      }`}
                    >
                      Status: {ingestAlert.label}
                    </span>
                    {ingestAlert.stale ? (
                      <span className="text-amber-300">stale scheduler signal</span>
                    ) : null}
                  </div>
                  <div
                    className={
                      ingestAlert.level === "critical"
                        ? "text-rose-300"
                        : ingestAlert.level === "warning"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }
                  >
                    {ingestAlert.message}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                        liveOps.lastRunStatus === "error"
                          ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                          : liveOps.lastRunStatus === "success"
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                          : "border-slate-700/70 bg-slate-900/70 text-slate-300"
                      }`}
                    >
                      Last run: {liveOps.lastRunStatus ?? "unknown"}
                    </span>
                    <span className="text-slate-400">
                      failures in a row: {liveOps.consecutiveFailures ?? 0}
                    </span>
                  </div>
                  <div>
                    Last run at: {liveOps.lastRunAt || "—"}{" "}
                    {liveOps.lastRunProvider ? `• ${liveOps.lastRunProvider}` : ""}
                    {liveOps.mode ? ` • mode ${liveOps.mode}` : ""}
                  </div>
                  <div>
                    Last run payload: matches {liveOps.lastRunMatches ?? 0}, updated{" "}
                    {liveOps.lastRunUpdated ?? 0}
                  </div>
                  <div>Last success: {liveOps.lastSuccessAt || "—"}</div>
                  <div>Last error: {liveOps.lastErrorAt || "—"}</div>
                  <div
                    className={
                      liveOps.lastErrorMessage
                        ? "text-rose-300"
                        : "text-slate-400"
                    }
                  >
                    Error message: {liveOps.lastErrorMessage || "—"}
                  </div>

                  {liveOps.recentRuns && liveOps.recentRuns.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <div className="font-semibold text-slate-100">
                        Recent Runs ({liveOps.recentRuns.length})
                      </div>
                      <div className="max-h-40 overflow-auto space-y-1 pr-1">
                        {liveOps.recentRuns.map((run, idx) => (
                          <div
                            key={`${run.at}-${idx}`}
                            className="rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-slate-400">{run.at}</span>
                              <span
                                className={
                                  run.status === "error"
                                    ? "text-rose-300"
                                    : "text-emerald-300"
                                }
                              >
                                {run.status}
                              </span>
                              <span className="text-slate-300">{run.provider}</span>
                              <span className="text-slate-400">
                                m:{run.matches} u:{run.updated}
                              </span>
                            </div>
                            {run.errorMessage ? (
                              <div className="text-rose-300 mt-0.5">
                                {run.errorMessage}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100">
                      Transfer Window
                    </div>
                    <div className="text-xs text-slate-400">
                      Enable for transfer testing without console scripts.
                    </div>
                  </div>
                  <div
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                      transferWindow.enabled
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-700/70 bg-slate-900/70 text-slate-300"
                    }`}
                  >
                    {transferWindow.enabled ? "OPEN" : "CLOSED"}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={transferWindowEnabledInput}
                    onChange={(e) => setTransferWindowEnabledInput(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Enable transfer window
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-sm text-slate-300">
                    Starts at (optional)
                    <input
                      type="datetime-local"
                      value={transferWindowStartsInput}
                      onChange={(e) => setTransferWindowStartsInput(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>

                  <label className="block text-sm text-slate-300">
                    Ends at (optional)
                    <input
                      type="datetime-local"
                      value={transferWindowEndsInput}
                      onChange={(e) => setTransferWindowEndsInput(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    onClick={() => void openTransferWindowNow()}
                    disabled={!uid || savingTransferWindow || !dangerConfirmed}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
                  >
                    Open Window Now
                  </button>
                  <button
                    onClick={() => void saveTransferWindow()}
                    disabled={!uid || savingTransferWindow || !dangerConfirmed}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
                  >
                    {savingTransferWindow ? "Saving..." : "Save Transfer Window"}
                  </button>
                  <button
                    onClick={() => void closeTransferWindowNow()}
                    disabled={!uid || savingTransferWindow || !dangerConfirmed}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
                  >
                    Close Window Now
                  </button>
                </div>

                {transferWindowStatus ? (
                  <div className="text-sm text-slate-300">{transferWindowStatus}</div>
                ) : null}

                <div className="text-xs text-slate-400">
                  Last update: {transferWindow.updatedAt || "—"}{" "}
                  {transferWindow.updatedBy
                    ? `• by ${transferWindow.updatedBy}`
                    : ""}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
                Optional controls (leave blank for full fixture):
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100">
                      Local Visible Rehearsal
                    </div>
                    <div className="text-xs text-emerald-100/80">
                      Public localhost matches only. Users and entries stay.
                    </div>
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 rounded-full border border-emerald-400/50 bg-emerald-400/15 text-emerald-100">
                    Wave {Math.min(liveSimulatorState.nextWave + 1, liveSimulatorState.totalWaves)}
                    /{liveSimulatorState.totalWaves}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={previewPublicRehearsalReset}
                    disabled={
                      !uid ||
                      previewingPublicRehearsalReset ||
                      resettingPublicRehearsal
                    }
                    className="px-4 py-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 text-emerald-100 font-semibold disabled:opacity-50"
                  >
                    {previewingPublicRehearsalReset
                      ? "Previewing..."
                      : "Preview Reset"}
                  </button>
                  <button
                    onClick={resetPublicRehearsalState}
                    disabled={
                      !uid ||
                      resettingPublicRehearsal ||
                      runningLiveSimulatorWave ||
                      !dangerConfirmed
                    }
                    className="px-4 py-2 rounded-xl bg-amber-500/90 text-amber-950 font-semibold disabled:opacity-50"
                  >
                    {resettingPublicRehearsal
                      ? "Resetting..."
                      : "Reset Visible Data"}
                  </button>
                  <button
                    onClick={runLiveSimulatorWave}
                    disabled={
                      !uid ||
                      runningLiveSimulatorWave ||
                      resettingPublicRehearsal ||
                      !dangerConfirmed
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
                  >
                    {runningLiveSimulatorWave
                      ? "Running Wave..."
                      : "Run Next Live Wave"}
                  </button>
                  <div className="rounded-lg border border-emerald-400/20 bg-slate-950/40 px-3 py-2 text-xs text-emerald-50/90">
                    Last:{" "}
                    {liveSimulatorState.lastLabel
                      ? `${liveSimulatorState.lastLabel}`
                      : "none"}
                    {liveSimulatorState.updatedAt
                      ? ` • ${liveSimulatorState.updatedAt}`
                      : ""}
                  </div>
                </div>

                {publicRehearsalStatus ? (
                  <div className="text-sm text-slate-200">
                    {publicRehearsalStatus}
                  </div>
                ) : null}
                {liveSimulatorStatus ? (
                  <div className="text-sm text-slate-200">
                    {liveSimulatorStatus}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <label className="block text-sm text-slate-300">
                  Max matches
                  <input
                    type="number"
                    min="1"
                    value={maxMatches}
                    onChange={(e) => setMaxMatches(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    placeholder="e.g., 4"
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Cutoff ISO timestamp
                  <input
                    type="text"
                    value={cutoffIso}
                    onChange={(e) => setCutoffIso(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    placeholder="e.g., 2022-11-22T00:00:00Z"
                  />
                </label>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={runFixtureIngest}
                  disabled={!uid || running || !acknowledged || !dangerConfirmed}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
                >
                  {running ? "Running..." : "Run Fixture Ingest"}
                </button>

                <button
                  onClick={previewFixture}
                  disabled={!uid || previewing}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
                >
                  {previewing ? "Previewing..." : "Preview Selection"}
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="h-4 w-4"
                />
                I understand this will write fixture data to Firestore.
              </label>

              {preview ? <div className="text-sm text-slate-300">{preview}</div> : null}
              <div className="text-sm text-slate-300">{status}</div>

              <div className="border-t border-slate-800/60 pt-4 space-y-3">
                <div className="text-sm font-semibold text-slate-100">
                  Deterministic Reset + Ingest
                </div>
                <p className="text-xs text-slate-400">
                  Deletes all fixture-sourced match docs, then ingests the current
                  selection.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    onClick={runResetFixtureIngest}
                    disabled={
                      !uid ||
                      resetRunning ||
                      running ||
                      !acknowledged ||
                      !dangerConfirmed
                    }
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500/90 text-amber-950 font-semibold disabled:opacity-50"
                  >
                    {resetRunning ? "Running..." : "Reset + Ingest"}
                  </button>

                  <button
                    onClick={previewResetFixture}
                    disabled={
                      !uid ||
                      resetPreviewing ||
                      previewing ||
                      resetRunning
                    }
                    className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
                  >
                    {resetPreviewing ? "Previewing..." : "Preview Reset"}
                  </button>
                </div>
                {resetPreview ? (
                  <div className="text-sm text-slate-300">{resetPreview}</div>
                ) : null}
                {resetStatus ? (
                  <div className="text-sm text-slate-300">{resetStatus}</div>
                ) : null}
              </div>

              <div className="border-t border-slate-800/60 pt-4 space-y-3">
                <div className="text-sm font-semibold text-slate-100">
                  Pre-Tournament Match Data
                </div>
                <p className="text-xs text-slate-400">
                  Import pre-tournament friendlies and qualifiers (3-5 matches per
                  team) so users see match history from day one.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <button
                    onClick={runPreTournamentIngest}
                    disabled={
                      !uid || preTournamentRunning || !acknowledged || !dangerConfirmed
                    }
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
                  >
                    {preTournamentRunning
                      ? "Importing..."
                      : "Import Pre-Tournament Data"}
                  </button>

                  <button
                    onClick={previewPreTournament}
                    disabled={!uid || preTournamentPreviewing}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 disabled:opacity-50"
                  >
                    {preTournamentPreviewing
                      ? "Previewing..."
                      : "Preview Pre-Tournament"}
                  </button>
                </div>

                {preTournamentPreview ? (
                  <div className="text-sm text-slate-300">
                    {preTournamentPreview}
                  </div>
                ) : null}
                {preTournamentStatus ? (
                  <div className="text-sm text-slate-300">
                    {preTournamentStatus}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-800/60 pt-4 space-y-3">
                <div className="text-sm font-semibold text-slate-100">
                  Fixture Replay Shadow
                </div>
                <p className="text-xs text-slate-400">
                  Replays fixture waves through the same validation pipeline into
                  <code className="mx-1 text-emerald-200/90">shadowMatches</code>
                  without touching public match docs.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <label className="block text-sm text-slate-300">
                    Wave size
                    <input
                      type="number"
                      min="1"
                      value={replayWaveSize}
                      onChange={(e) => setReplayWaveSize(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>
                  <button
                    onClick={runReplayWave}
                    disabled={
                      !uid ||
                      runningReplay ||
                      resettingReplay ||
                      !dangerConfirmed
                    }
                    className="px-4 py-2 rounded-xl bg-violet-500/90 text-violet-950 font-semibold disabled:opacity-50"
                  >
                    {runningReplay ? "Running Replay..." : "Run Replay Wave"}
                  </button>
                  <button
                    onClick={resetReplayShadow}
                    disabled={
                      !uid ||
                      runningReplay ||
                      resettingReplay ||
                      !dangerConfirmed
                    }
                    className="px-4 py-2 rounded-xl border border-violet-400/50 bg-violet-500/10 text-violet-100 font-semibold disabled:opacity-50"
                  >
                    {resettingReplay ? "Resetting Replay..." : "Reset Replay Shadow"}
                  </button>
                </div>
                <div className="text-sm text-slate-300">
                  Cursor: {fixtureReplayState.cursor}
                  {fixtureReplayState.total !== null &&
                  fixtureReplayState.total !== undefined
                    ? ` / ${fixtureReplayState.total}`
                    : ""}
                  {" · "}Shadow matches: {fixtureReplayState.shadowMatchCount}
                  {" · "}Done: {fixtureReplayState.done ? "yes" : "no"}
                </div>
                {replayStatus ? (
                  <div className="text-sm text-slate-300">{replayStatus}</div>
                ) : null}
              </div>

              <div className="border-t border-slate-800/60 pt-4 space-y-2">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={recomputeLeaderboard}
                    disabled={
                      !uid ||
                      recomputing ||
                      retryingDirtyRecompute ||
                      recomputingShadow ||
                      !dangerConfirmed
                    }
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 disabled:opacity-50"
                  >
                    {recomputing ? "Recomputing..." : "Recompute Leaderboard"}
                  </button>
                  <button
                    onClick={recomputeShadowLeaderboard}
                    disabled={
                      !uid ||
                      recomputing ||
                      retryingDirtyRecompute ||
                      recomputingShadow ||
                      !dangerConfirmed
                    }
                    className="px-4 py-2 rounded-xl border border-violet-400/50 bg-violet-500/10 text-violet-100 disabled:opacity-50"
                  >
                    {recomputingShadow
                      ? "Recomputing Shadow..."
                      : "Recompute Shadow Leaderboard"}
                  </button>
                  <button
                    onClick={retryDirtyLeaderboard}
                    disabled={
                      !uid ||
                      recomputing ||
                      retryingDirtyRecompute ||
                      recomputingShadow ||
                      !dangerConfirmed
                    }
                    className="px-4 py-2 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-100 disabled:opacity-50"
                  >
                    {retryingDirtyRecompute
                      ? "Retrying Dirty Scores..."
                      : "Retry Dirty Scores"}
                  </button>
                </div>
                {recomputeStatus ? (
                  <div className="text-sm text-slate-300">{recomputeStatus}</div>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-sm text-slate-300">
                <div className="font-semibold mb-2 text-slate-100">
                  Leaderboard Status
                </div>
                <div>
                  Last updated:{" "}
                  {leaderboardStatus.lastUpdated
                    ? leaderboardStatus.lastUpdated
                    : "—"}
                </div>
                <div>
                  Scoring version:{" "}
                  {leaderboardStatus.scoringVersion
                    ? leaderboardStatus.scoringVersion
                    : "—"}
                </div>
                <div>
                  Include live:{" "}
                  {typeof leaderboardStatus.includeLive === "boolean"
                    ? String(leaderboardStatus.includeLive)
                    : "—"}
                </div>
                <div className="mt-3 border-t border-slate-800/60 pt-3">
                  <div className="font-semibold mb-2 text-slate-100">
                    Shadow Leaderboard Status
                  </div>
                  <div>
                    Last updated:{" "}
                    {shadowLeaderboardStatus.lastUpdated
                      ? shadowLeaderboardStatus.lastUpdated
                      : "—"}
                  </div>
                  <div>
                    Last attempt:{" "}
                    {shadowLeaderboardStatus.lastAttemptAt
                      ? shadowLeaderboardStatus.lastAttemptAt
                      : "—"}
                  </div>
                  <div>
                    Scoring version:{" "}
                    {shadowLeaderboardStatus.scoringVersion
                      ? shadowLeaderboardStatus.scoringVersion
                      : "—"}
                  </div>
                  <div>
                    Include live:{" "}
                    {typeof shadowLeaderboardStatus.includeLive === "boolean"
                      ? String(shadowLeaderboardStatus.includeLive)
                      : "—"}
                  </div>
                  <div>
                    Source collection:{" "}
                    {shadowLeaderboardStatus.sourceCollection || "—"}
                  </div>
                  <div>Target: {shadowLeaderboardStatus.target || "—"}</div>
                  <div>
                    Row count:{" "}
                    {typeof shadowLeaderboardStatus.rowCount === "number"
                      ? shadowLeaderboardStatus.rowCount
                      : "—"}
                  </div>
                  <div>Updated by: {shadowLeaderboardStatus.updatedBy || "—"}</div>
                  <div>
                    Last error:{" "}
                    {shadowLeaderboardStatus.lastErrorAt
                      ? shadowLeaderboardStatus.lastErrorAt
                      : "—"}
                  </div>
                  {shadowLeaderboardStatus.lastErrorMessage ? (
                    <div className="text-rose-300">
                      Shadow recompute error:{" "}
                      {shadowLeaderboardStatus.lastErrorMessage}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 border-t border-slate-800/60 pt-3">
                  <div className="font-semibold mb-2 text-slate-100">
                    Public vs Shadow Comparison
                  </div>
                  <div>Public rows: {leaderboardDiff.publicCount}</div>
                  <div>Shadow rows: {leaderboardDiff.shadowCount}</div>
                  <div>Detected mismatches: {leaderboardDiff.mismatchCount}</div>
                  {leaderboardDiff.topMismatches.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {leaderboardDiff.topMismatches.map((row) => (
                        <div
                          key={row.userId}
                          className="rounded border border-slate-800/80 bg-slate-950/60 px-2 py-1"
                        >
                          <div className="text-slate-100">{row.displayName}</div>
                          <div className="text-xs text-slate-400">
                            public r{row.publicRank ?? "—"} / s{row.publicScore ?? "—"}
                            {" · "}
                            shadow r{row.shadowRank ?? "—"} / s{row.shadowScore ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-emerald-300">
                      No public-vs-shadow mismatch detected in the current rows.
                    </div>
                  )}
                </div>
                <div className="mt-3 border-t border-slate-800/60 pt-3">
                  <div className="font-semibold mb-2 text-slate-100">
                    Ingest / Recompute Health
                  </div>
                  <div>Match data updated: {ingestHealth.lastIngestSuccessAt ? "yes" : "no"}</div>
                  <div>Leaderboard current: {ingestHealth.scoresDirty ? "no" : "yes"}</div>
                  <div>Scores dirty: {ingestHealth.scoresDirty ? "yes" : "no"}</div>
                  <div>Dirty reason: {ingestHealth.dirtyReason || "—"}</div>
                  <div>Active provider: {ingestHealth.activeProvider || "—"}</div>
                  <div>Mode: {ingestHealth.mode || "—"}</div>
                  <div>Last ingest attempt: {ingestHealth.lastIngestAttemptAt || "—"}</div>
                  <div>Last ingest success: {ingestHealth.lastIngestSuccessAt || "—"}</div>
                  <div>Last ingest error: {ingestHealth.lastIngestErrorAt || "—"}</div>
                  <div>Last recompute attempt: {ingestHealth.lastRecomputeAttemptAt || "—"}</div>
                  <div>Last recompute: {ingestHealth.lastRecomputeSuccessAt || "—"}</div>
                  <div>Last recompute error: {ingestHealth.lastRecomputeErrorAt || "—"}</div>
                  {ingestHealth.lastIngestErrorMessage ? (
                    <div className="text-rose-300">
                      Ingest error: {ingestHealth.lastIngestErrorMessage}
                    </div>
                  ) : null}
                  {ingestHealth.lastRecomputeErrorMessage ? (
                    <div className="text-rose-300">
                      Recompute error: {ingestHealth.lastRecomputeErrorMessage}
                    </div>
                  ) : null}
                </div>
              </div>
    </>
  );
}

export default function FixtureIngestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin · Fixture Ingest
              </h1>
              <a
                href="/admin"
                className="text-xs uppercase tracking-widest text-slate-400 hover:text-emerald-200"
              >
                Back to Tools
              </a>
            </div>
            <AdminEnvironmentBadge />
          </div>

          <AdminGate>{({ uid }) => <FixtureIngestContent uid={uid} />}</AdminGate>
        </div>
      </div>
    </div>
  );
}
