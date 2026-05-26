import type {
  MatchStage,
  MatchStatus,
  NormalizedMatchUpdate,
} from "./providerTypes";

type SimMatch = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  stage: MatchStage;
  kickoffTime: string;
};

type SimScore = {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
};

const MATCHES: SimMatch[] = [
  {
    id: "ff2026-sim-001",
    homeTeamId: "MEX",
    awayTeamId: "ZAF",
    stage: "GROUP",
    kickoffTime: "2026-06-11T19:00:00Z",
  },
  {
    id: "ff2026-sim-002",
    homeTeamId: "CAN",
    awayTeamId: "QAT",
    stage: "GROUP",
    kickoffTime: "2026-06-12T16:00:00Z",
  },
  {
    id: "ff2026-sim-003",
    homeTeamId: "BRA",
    awayTeamId: "MAR",
    stage: "GROUP",
    kickoffTime: "2026-06-12T19:00:00Z",
  },
  {
    id: "ff2026-sim-004",
    homeTeamId: "USA",
    awayTeamId: "AUS",
    stage: "GROUP",
    kickoffTime: "2026-06-13T16:00:00Z",
  },
  {
    id: "ff2026-sim-005",
    homeTeamId: "GER",
    awayTeamId: "ECU",
    stage: "GROUP",
    kickoffTime: "2026-06-13T19:00:00Z",
  },
  {
    id: "ff2026-sim-006",
    homeTeamId: "KOR",
    awayTeamId: "CZE",
    stage: "GROUP",
    kickoffTime: "2026-06-14T16:00:00Z",
  },
];

const WAVES: Array<{
  label: string;
  scores: SimScore[];
}> = [
  {
    label: "Kickoff board",
    scores: MATCHES.map(() => ({
      status: "SCHEDULED",
      homeScore: null,
      awayScore: null,
    })),
  },
  {
    label: "Opening live swing",
    scores: [
      { status: "LIVE", homeScore: 1, awayScore: 0, homeYellowCards: 1 },
      { status: "LIVE", homeScore: 0, awayScore: 1, awayYellowCards: 1 },
      { status: "LIVE", homeScore: 2, awayScore: 1, homeYellowCards: 1 },
      { status: "SCHEDULED", homeScore: null, awayScore: null },
      { status: "SCHEDULED", homeScore: null, awayScore: null },
      { status: "SCHEDULED", homeScore: null, awayScore: null },
    ],
  },
  {
    label: "Second wave live",
    scores: [
      { status: "FINISHED", homeScore: 2, awayScore: 0, homeYellowCards: 1 },
      { status: "FINISHED", homeScore: 1, awayScore: 1, awayYellowCards: 2 },
      { status: "FINISHED", homeScore: 3, awayScore: 1, homeYellowCards: 1 },
      { status: "LIVE", homeScore: 0, awayScore: 2, awayYellowCards: 1 },
      { status: "LIVE", homeScore: 1, awayScore: 1 },
      { status: "LIVE", homeScore: 0, awayScore: 0, homeYellowCards: 1 },
    ],
  },
  {
    label: "Final whistle",
    scores: [
      { status: "FINISHED", homeScore: 2, awayScore: 0, homeYellowCards: 1 },
      { status: "FINISHED", homeScore: 1, awayScore: 1, awayYellowCards: 2 },
      { status: "FINISHED", homeScore: 3, awayScore: 1, homeYellowCards: 1 },
      { status: "FINISHED", homeScore: 1, awayScore: 2, awayYellowCards: 1 },
      { status: "FINISHED", homeScore: 2, awayScore: 1, homeYellowCards: 1 },
      { status: "FINISHED", homeScore: 0, awayScore: 0, homeYellowCards: 1 },
    ],
  },
];

export function getLocalLiveSimulatorWave(options?: { waveIndex?: number }): {
  label: string;
  waveIndex: number;
  totalWaves: number;
  done: boolean;
  updates: NormalizedMatchUpdate[];
} {
  const requested =
    typeof options?.waveIndex === "number" && Number.isFinite(options.waveIndex)
      ? Math.floor(options.waveIndex)
      : 0;
  const waveIndex = Math.max(0, Math.min(WAVES.length - 1, requested));
  const wave = WAVES[waveIndex];
  const nowIso = new Date().toISOString();

  return {
    label: wave.label,
    waveIndex,
    totalWaves: WAVES.length,
    done: waveIndex >= WAVES.length - 1,
    updates: MATCHES.map((match, index) => {
      const score = wave.scores[index];
      return {
        provider: "local-live-sim",
        providerMatchId: match.id,
        canonicalMatchId: match.id,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        kickoffTime: match.kickoffTime,
        status: score.status,
        stage: match.stage,
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        homeRedCards: score.homeRedCards ?? 0,
        homeYellowCards: score.homeYellowCards ?? 0,
        awayRedCards: score.awayRedCards ?? 0,
        awayYellowCards: score.awayYellowCards ?? 0,
        providerUpdatedAt: nowIso,
        ingestReceivedAt: nowIso,
        revision: waveIndex + 1,
      };
    }),
  };
}
