import { FieldValue } from "firebase-admin/firestore";

/**
 * Patch the client-facing match summary document (settings/matchSummary).
 * Reads the existing summary, merges the updated match entries, and writes
 * back.  Cost: 1 read + 1 write per call instead of N × 104 client reads
 * across all connected users.
 *
 * The dashboard reads matches from this single aggregate doc, NOT from the
 * matches collection — so any write to a match (ingest OR a manual admin
 * correction) must propagate here, or the change is invisible to players.
 *
 * teamNames / teamFlags in the summary are seeded separately and are not
 * touched here (they only change when teams are re-seeded).
 */
export async function patchMatchSummary(
  db: FirebaseFirestore.Firestore,
  updatedEntries: Array<{ id: string; data: Record<string, unknown> }>
): Promise<void> {
  const summaryRef = db.collection("settings").doc("matchSummary");
  const existing = await summaryRef.get();
  const existingData = (existing.exists ? existing.data() : {}) as Record<string, unknown>;
  const existingMatches: Record<string, unknown>[] = Array.isArray(existingData.matches)
    ? (existingData.matches as Record<string, unknown>[])
    : [];

  // Build a map keyed by matchId so we can merge efficiently
  const matchMap: Record<string, Record<string, unknown>> = {};
  existingMatches.forEach((m) => {
    if (typeof m.id === "string") matchMap[m.id] = m;
  });

  // Overwrite the changed entries with compact, plain-JSON data
  updatedEntries.forEach(({ id, data }) => {
    matchMap[id] = {
      id,
      kickoffTime: typeof data.kickoffTime === "string" ? data.kickoffTime : null,
      stage: typeof data.stage === "string" ? data.stage : null,
      status: typeof data.status === "string" ? data.status : null,
      homeTeamId: typeof data.homeTeamId === "string" ? data.homeTeamId : null,
      awayTeamId: typeof data.awayTeamId === "string" ? data.awayTeamId : null,
      homeScore: typeof data.homeScore === "number" ? data.homeScore : null,
      awayScore: typeof data.awayScore === "number" ? data.awayScore : null,
      group: typeof data.group === "string" ? data.group : null,
      isPlaceholder: data.isPlaceholder === true,
      homePlaceholder: typeof data.homePlaceholder === "string" ? data.homePlaceholder : null,
      awayPlaceholder: typeof data.awayPlaceholder === "string" ? data.awayPlaceholder : null,
      minute: typeof data.minute === "number" ? data.minute : null,
      homeScoreHT: typeof data.homeScoreHT === "number" ? data.homeScoreHT : null,
      awayScoreHT: typeof data.awayScoreHT === "number" ? data.awayScoreHT : null,
      homeScorePens: typeof data.homeScorePens === "number" ? data.homeScorePens : null,
      awayScorePens: typeof data.awayScorePens === "number" ? data.awayScorePens : null,
      winner: typeof data.winner === "string" ? data.winner : null,
      homeYellowCards: typeof data.homeYellowCards === "number" ? data.homeYellowCards : 0,
      awayYellowCards: typeof data.awayYellowCards === "number" ? data.awayYellowCards : 0,
      homeRedCards: typeof data.homeRedCards === "number" ? data.homeRedCards : 0,
      awayRedCards: typeof data.awayRedCards === "number" ? data.awayRedCards : 0,
      goals: Array.isArray(data.goals) ? data.goals : [],
    };
  });

  await summaryRef.set({
    matches: Object.values(matchMap),
    teamNames: existingData.teamNames ?? {},
    teamFlags: existingData.teamFlags ?? {},
    updatedAt: FieldValue.serverTimestamp(),
  });
}
