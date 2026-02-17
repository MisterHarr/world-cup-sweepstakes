import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// Keep region consistent with the rest of your functions
const REGION = "asia-southeast1";

type TeamOut = {
  id: string;
  name?: string;
  group?: string;
  tier?: number;
  flagUrl?: string;
  contribution: number;
};

function asString(x: unknown): string | null {
  return typeof x === "string" && x.trim().length ? x.trim() : null;
}

function asNumber(x: unknown, fallback = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/**
 * Calculate total points contributed by a team from aggregate fields
 * using the same formula as scoring/dashboard:
 * 3*W + D + GS + CS - RC - 0.5*YC
 */
function calculateTeamContributionFromDoc(data: any): number {
  const wins = asNumber(data?.wins);
  const draws = asNumber(data?.draws);
  const goalsScored = asNumber(data?.goalsScored);
  const cleanSheets = asNumber(data?.cleanSheets);
  const redCards = asNumber(data?.redCards);
  const yellowCards = asNumber(data?.yellowCards);

  return wins * 3 + draws + goalsScored + cleanSheets - redCards - yellowCards * 0.5;
}

export const getSquadDetails = onCall({ region: REGION }, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const db = admin.firestore();
  const callerUid = auth.uid;
  const requestedUserId = asString(request.data?.userId) ?? callerUid;

  // All authenticated users can view any squad (public visibility for engagement)
  // Privacy settings may be added in future if needed

  const userRef = db.collection("users").doc(requestedUserId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return {
      ok: true,
      userId: requestedUserId,
      displayName: "Anonymous",
      totalScore: 0,
      featured: null,
      drawn: [],
    };
  }

  const user = userSnap.data() as any;

  // Support BOTH schemas:
  // A) user.entry.featuredTeamId + user.entry.drawnTeamIds
  // B) user.portfolio: [{teamId, role:"featured"|"drawn"}]
  const entryFeaturedId = asString(user?.entry?.featuredTeamId);
  const entryDrawnIds: string[] = Array.isArray(user?.entry?.drawnTeamIds)
    ? user.entry.drawnTeamIds.map(asString).filter(Boolean) as string[]
    : [];

  const portfolio: Array<{ teamId?: unknown; role?: unknown }> = Array.isArray(
    user?.portfolio
  )
    ? user.portfolio
    : [];

  const portfolioFeaturedId = asString(
    portfolio.find((p) => p?.role === "featured")?.teamId
  );

  const portfolioDrawnIds: string[] = portfolio
    .filter((p) => p?.role === "drawn")
    .map((p) => asString(p?.teamId))
    .filter(Boolean) as string[];

  const featuredId = entryFeaturedId ?? portfolioFeaturedId ?? null;
  const drawnIds = uniq([...entryDrawnIds, ...portfolioDrawnIds]).slice(0, 5);

  const idsToFetch = uniq([...(featuredId ? [featuredId] : []), ...drawnIds]);

  // Fetch teams by *document id* first
  const teamRefs = idsToFetch.map((id) => db.collection("teams").doc(id));
  const teamSnaps = idsToFetch.length ? await db.getAll(...teamRefs) : [];

  const teamsById: Record<string, TeamOut> = {};
  teamSnaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() as any;
    const id = snap.id;

    const isFeatured = id === featuredId;
    const multiplier = isFeatured ? 2 : 1;
    const baseContribution = calculateTeamContributionFromDoc(data);

    teamsById[id] = {
      id,
      name: data?.name,
      group: data?.group,
      tier: typeof data?.tier === "number" ? data.tier : Number(data?.tier ?? 0),
      flagUrl: data?.flagUrl,
      contribution: baseContribution * multiplier,
    };
  });

  // Fallback: if your teams store "id" inside the doc and docId differs,
  // try to match by scanning (only when we failed to resolve some IDs).
  const unresolved = idsToFetch.filter((id) => !teamsById[id]);
  if (unresolved.length) {
    const allTeamsSnap = await db.collection("teams").get();
    for (const d of allTeamsSnap.docs) {
      const data = d.data() as any;
      const internalId = asString(data?.id);
      if (internalId && unresolved.includes(internalId)) {
        const isFeatured = internalId === featuredId;
        const multiplier = isFeatured ? 2 : 1;
        const baseContribution = calculateTeamContributionFromDoc(data);

        teamsById[internalId] = {
          id: internalId,
          name: data?.name,
          group: data?.group,
          tier:
            typeof data?.tier === "number"
              ? data.tier
              : Number(data?.tier ?? 0),
          flagUrl: data?.flagUrl,
          contribution: baseContribution * multiplier,
        };
      }
    }
  }

  const displayName =
    asString(user?.displayName) ??
    asString(user?.name) ??
    asString(user?.email) ??
    "Anonymous";

  const featured = featuredId
    ? teamsById[featuredId] ?? { id: featuredId, contribution: 0 }
    : null;
  const drawn = drawnIds.map((id) => teamsById[id] ?? { id, contribution: 0 });

  const derivedTotalScore =
    asNumber(featured?.contribution) +
    drawn.reduce((sum, team) => sum + asNumber(team?.contribution), 0) -
    asNumber(user?.transferPenaltyPoints);

  const totalScore = asNumber(user?.totalScore, derivedTotalScore);

  return {
    ok: true,
    userId: requestedUserId,
    displayName,
    totalScore,
    featured,
    drawn,
  };
});
