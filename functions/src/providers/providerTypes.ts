export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";
export type MatchStage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "FINAL";

/**
 * A goal event extracted from the provider. teamSide is home/away relative to
 * the match (own-goals are recorded under the SCORING team, not the own-goal team).
 */
export type ProviderGoal = {
  minute: number | null;
  playerName: string | null;
  teamSide: "home" | "away";
  /** REGULAR = normal goal; OWN_GOAL = own goal; PENALTY = pen in normal/ET play (not shootout) */
  type: "REGULAR" | "OWN_GOAL" | "PENALTY" | "EXTRA_TIME";
};

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
  /**
   * True if the card counts came from a successful per-match DETAIL fetch.
   * The competition LIST endpoint returns empty bookings[] and would yield
   * zeros — writers must NOT clobber existing card data when this is false.
   */
  cardsEnriched?: boolean;
  // Live / richer display data (Deep Data plan)
  minute?: number | null;
  homeScoreHT?: number | null;
  awayScoreHT?: number | null;
  homeScorePens?: number | null;
  awayScorePens?: number | null;
  /** Resolved winner — HOME or AWAY. Only set when match is FINISHED and decided on pens or ET. */
  winner?: "HOME" | "AWAY" | null;
  goals?: ProviderGoal[];
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
  homeScore: number | null;
  awayScore: number | null;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
  /** See ProviderMatch.cardsEnriched — false means "list-derived zeros, do not overwrite". */
  cardsEnriched?: boolean;
  // Rich display fields
  minute?: number | null;
  homeScoreHT?: number | null;
  awayScoreHT?: number | null;
  homeScorePens?: number | null;
  awayScorePens?: number | null;
  winner?: "HOME" | "AWAY" | null;
  goals?: ProviderGoal[];
  events?: NormalizedMatchEvent[];
  providerUpdatedAt: string;
  ingestReceivedAt: string;
  revision: number;
  correction?: boolean;
};
