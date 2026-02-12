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
};

function asString(x: unknown): string | null {
  return typeof x === "string" && x.trim().length ? x.trim() : null;
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

export const getSquadDetails = onCall({ region: REGION }, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const db = admin.firestore();
  const callerUid = auth.uid;
  const requestedUserId = asString(request.data?.userId) ?? callerUid;
  const isAdmin = (auth.token as { admin?: boolean })?.admin === true;

  if (requestedUserId !== callerUid && !isAdmin) {
    throw new HttpsError(
      "permission-denied",
      "You can only access your own squad details."
    );
  }

  const userRef = db.collection("users").doc(requestedUserId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return {
      ok: true,
      userId: requestedUserId,
      displayName: "Anonymous",
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
    teamsById[id] = {
      id,
      name: data?.name,
      group: data?.group,
      tier: typeof data?.tier === "number" ? data.tier : Number(data?.tier ?? 0),
      flagUrl: data?.flagUrl,
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
        teamsById[internalId] = {
          id: internalId,
          name: data?.name,
          group: data?.group,
          tier:
            typeof data?.tier === "number"
              ? data.tier
              : Number(data?.tier ?? 0),
          flagUrl: data?.flagUrl,
        };
      }
    }
  }

  const displayName =
    asString(user?.displayName) ??
    asString(user?.name) ??
    asString(user?.email) ??
    "Anonymous";

  const featured = featuredId ? teamsById[featuredId] ?? { id: featuredId } : null;
  const drawn = drawnIds.map((id) => teamsById[id] ?? { id });

  return {
    ok: true,
    userId: requestedUserId,
    displayName,
    featured,
    drawn,
  };
});
