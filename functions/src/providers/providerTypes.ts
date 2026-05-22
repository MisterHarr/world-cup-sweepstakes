export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";
export type MatchStage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "FINAL";

export type ProviderMatch = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  stage: MatchStage;
  kickoffTime: string | null;
  homeRedCards: number;
  homeYellowCards: number;
  awayRedCards: number;
  awayYellowCards: number;
};

export type NormalizedMatchProvider =
  | "fixture-replay"
  | "local-live-sim"
  | "football-data"
  | "manual";

export type NormalizedMatchEvent = {
  type: string;
  teamId?: string;
  minute?: number;
  playerName?: string;
};

export type NormalizedMatchUpdate = {
  provider: NormalizedMatchProvider;
  providerMatchId: string;
  canonicalMatchId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffTime: string | null;
  status: MatchStatus;
  stage: MatchStage;
  minute?: number;
  homeScore: number | null;
  awayScore: number | null;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
  events?: NormalizedMatchEvent[];
  providerUpdatedAt: string;
  ingestReceivedAt: string;
  revision: number;
  correction?: boolean;
};
