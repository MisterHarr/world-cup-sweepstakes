"use client";

import { useEffect, useState } from "react";
import { auth, functions } from "@/lib/firebase";
import { getIdTokenResult } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function FixtureIngestPage() {
  type LiveOpsProvider = "stub" | "fixture" | "provider";
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
  };

  type SetLiveOpsSettingsPayload = {
    enabled: boolean;
    provider: LiveOpsProvider;
    fixtureMaxMatches: number;
    fixtureCutoffIso: string | null;
  };

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
    if (!state.enabled) {
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
          message: "Automation is enabled but no scheduler run has been recorded yet.",
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

  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
  const [acknowledged, setAcknowledged] = useState(false);
  const [leaderboardStatus, setLeaderboardStatus] = useState<{
    lastUpdated?: string;
    scoringVersion?: string;
    includeLive?: boolean;
  }>({});
  const [recomputeStatus, setRecomputeStatus] = useState("");
  const [recomputing, setRecomputing] = useState(false);
  const [liveOpsStatus, setLiveOpsStatus] = useState("");
  const [savingLiveOps, setSavingLiveOps] = useState(false);
  const [liveOps, setLiveOps] = useState<LiveOpsState>(DEFAULT_LIVE_OPS);
  const [liveOpsEnabledInput, setLiveOpsEnabledInput] = useState(false);
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
  const [checking, setChecking] = useState(true);

  const ingestAlert = buildIngestAlert(liveOps);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setUid(user?.uid ?? null);
      setIsAdmin(false);
      setChecking(true);

      if (!user) {
        setChecking(false);
        return;
      }

      try {
        const token = await getIdTokenResult(user, true);
        setIsAdmin(token.claims.admin === true);
      } catch (err) {
        console.error(err);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid || !isAdmin) {
      setLeaderboardStatus({});
      return;
    }

    const ref = doc(db, "leaderboard", "current");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLeaderboardStatus({});
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const updated = toIsoOrEmpty(data.lastUpdated);

      setLeaderboardStatus({
        lastUpdated: updated,
        scoringVersion:
          typeof data.scoringVersion === "string" ? data.scoringVersion : undefined,
        includeLive:
          typeof data.includeLive === "boolean" ? data.includeLive : undefined,
      });
    });

    return () => unsub();
  }, [uid, isAdmin]);

  useEffect(() => {
    if (!uid || !isAdmin) {
      setLiveOps(DEFAULT_LIVE_OPS);
      setLiveOpsEnabledInput(false);
      setLiveOpsProviderInput("fixture");
      setLiveOpsMaxInput("");
      setLiveOpsCutoffInput("");
      return;
    }

    const ref = doc(db, "settings", "liveOps");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLiveOps(DEFAULT_LIVE_OPS);
        setLiveOpsEnabledInput(false);
        setLiveOpsProviderInput("fixture");
        setLiveOpsMaxInput("");
        setLiveOpsCutoffInput("");
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const provider =
        data.provider === "stub" ||
        data.provider === "fixture" ||
        data.provider === "provider"
          ? data.provider
          : "fixture";
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
        data.lastRunProvider === "provider"
          ? data.lastRunProvider
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
                run.provider === "provider"
                  ? run.provider
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
        enabled: data.enabled === true,
        provider,
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
      setLiveOpsEnabledInput(nextState.enabled);
      setLiveOpsProviderInput(nextState.provider);
      setLiveOpsMaxInput(
        nextState.fixtureMaxMatches > 0 ? String(nextState.fixtureMaxMatches) : ""
      );
      setLiveOpsCutoffInput(nextState.fixtureCutoffIso);
    });

    return () => unsub();
  }, [uid, isAdmin]);

  useEffect(() => {
    if (!uid || !isAdmin) {
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
  }, [uid, isAdmin]);

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
    if (!isAdmin) {
      setStatus("❌ Admin access required.");
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
    if (!isAdmin) {
      setPreview("❌ Admin access required.");
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
    if (!isAdmin) {
      setResetPreview("❌ Admin access required.");
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
    if (!isAdmin) {
      setResetStatus("❌ Admin access required.");
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
    if (!uid || !isAdmin) {
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
    if (!uid || !isAdmin) {
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

  async function recomputeLeaderboard() {
    setRecomputeStatus("");
    if (!uid) {
      setRecomputeStatus("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setRecomputeStatus("❌ Admin access required.");
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

  async function saveLiveOpsSettings() {
    setLiveOpsStatus("");
    if (!uid) {
      setLiveOpsStatus("❌ Not signed in.");
      return;
    }
    if (!isAdmin) {
      setLiveOpsStatus("❌ Admin access required.");
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
        enabled: liveOpsEnabledInput,
        provider: liveOpsProviderInput,
        fixtureMaxMatches: maxRaw ? Math.floor(maxParsed) : 0,
        fixtureCutoffIso: cutoffTrimmed || null,
      });
      setLiveOpsStatus(
        `✅ Automation ${liveOpsEnabledInput ? "enabled" : "disabled"} (${liveOpsProviderInput}).`
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
    if (!isAdmin) {
      setTransferWindowStatus("❌ Admin access required.");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.35)] space-y-4">
          <div className="flex items-center justify-between">
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

          <div className="text-sm text-slate-300">
            Signed in: <strong>{uid ? "Yes" : "No"}</strong>{" · "}
            Admin: <strong>{isAdmin ? "Yes" : "No"}</strong>
          </div>

          {checking ? (
            <div className="text-sm text-slate-400">Checking access…</div>
          ) : !uid ? (
            <div className="text-sm text-slate-400">
              Please sign in to access admin tools.
            </div>
          ) : !isAdmin ? (
            <div className="text-sm text-slate-400">Not authorized.</div>
          ) : (
            <>
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
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                      liveOps.enabled
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-700/70 bg-slate-900/70 text-slate-300"
                    }`}
                  >
                    {liveOps.enabled ? "ENABLED" : "DISABLED"}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <option value="provider">Provider (production)</option>
                      <option value="stub">Stub (no ingest)</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-300 mt-6 sm:mt-8">
                    <input
                      type="checkbox"
                      checked={liveOpsEnabledInput}
                      onChange={(e) => setLiveOpsEnabledInput(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Enable scheduled ingest
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
                    disabled={!uid || !isAdmin || savingLiveOps}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
                  >
                    {savingLiveOps ? "Saving..." : "Save Automation Settings"}
                  </button>
                </div>

                {liveOpsStatus ? (
                  <div className="text-sm text-slate-300">{liveOpsStatus}</div>
                ) : null}

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
                    disabled={!uid || !isAdmin || savingTransferWindow}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
                  >
                    Open Window Now
                  </button>
                  <button
                    onClick={() => void saveTransferWindow()}
                    disabled={!uid || !isAdmin || savingTransferWindow}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
                  >
                    {savingTransferWindow ? "Saving..." : "Save Transfer Window"}
                  </button>
                  <button
                    onClick={() => void closeTransferWindowNow()}
                    disabled={!uid || !isAdmin || savingTransferWindow}
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
                  disabled={!uid || !isAdmin || running || !acknowledged}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500/90 text-emerald-950 font-semibold disabled:opacity-50"
                >
                  {running ? "Running..." : "Run Fixture Ingest"}
                </button>

                <button
                  onClick={previewFixture}
                  disabled={!uid || !isAdmin || previewing}
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
                      !isAdmin ||
                      resetRunning ||
                      running ||
                      !acknowledged
                    }
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500/90 text-amber-950 font-semibold disabled:opacity-50"
                  >
                    {resetRunning ? "Running..." : "Reset + Ingest"}
                  </button>

                  <button
                    onClick={previewResetFixture}
                    disabled={
                      !uid ||
                      !isAdmin ||
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
                      !uid || !isAdmin || preTournamentRunning || !acknowledged
                    }
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-sky-500/90 text-sky-950 font-semibold disabled:opacity-50"
                  >
                    {preTournamentRunning
                      ? "Importing..."
                      : "Import Pre-Tournament Data"}
                  </button>

                  <button
                    onClick={previewPreTournament}
                    disabled={!uid || !isAdmin || preTournamentPreviewing}
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

              <div className="border-t border-slate-800/60 pt-4 space-y-2">
                <button
                  onClick={recomputeLeaderboard}
                  disabled={!uid || !isAdmin || recomputing}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 disabled:opacity-50"
                >
                  {recomputing ? "Recomputing..." : "Recompute Leaderboard"}
                </button>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
