/**
 * seed-fake-live-match.ts
 * ────────────────────────
 * Seeds two fake matches into the emulator's `matches` collection so you can
 * preview the live match container UI without real data.
 *
 *   Match A: LIVE group stage match — England vs France, 67', 2-1, with goal
 *            scorers, half-time score, yellow cards, and a red card.
 *
 *   Match B: FINISHED knockout match — Brazil vs Germany, decided on pens,
 *            with full goal list, HT score, and penalty shootout score.
 *
 * Usage (emulator must already be running):
 *   npx tsx scripts/seed-fake-live-match.ts
 *   npx tsx scripts/seed-fake-live-match.ts --clear   # removes the fake docs
 */

export {};

const FAKE_MATCH_IDS = ["fake-live-001", "fake-finished-pens-001"];

process.env.FIREBASE_EMULATOR_PROJECT ??= "worldcup-sweepstake-2026";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";

async function main() {
  const args = process.argv.slice(2);
  const clear = args.includes("--clear");

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = adminModule.default ?? adminModule;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.FIREBASE_EMULATOR_PROJECT });
  }

  const db = admin.firestore();

  if (clear) {
    for (const id of FAKE_MATCH_IDS) {
      await db.collection("matches").doc(id).delete();
      console.log(`🗑  Deleted fake match: ${id}`);
    }
    await admin.app().delete();
    return;
  }

  const now = new Date().toISOString();

  // ── Match A: LIVE group stage ─────────────────────────────────────────────
  // England (home) 2 – 1 France (away), minute 67, HT was 1-1
  // Goal scorers: Kane 22' (pen), Bellingham 58' / Mbappé 45+2'
  // England: 2 yellows. France: 1 yellow, 1 red.
  await db.collection("matches").doc("fake-live-001").set({
    homeTeamId: "ENG",
    awayTeamId: "FRA",
    homeScore: 2,
    awayScore: 1,
    status: "LIVE",
    isLive: true,
    stage: "GROUP",
    group: "A",
    minute: 67,
    homeScoreHT: 1,
    awayScoreHT: 1,
    homeScorePens: null,
    awayScorePens: null,
    winner: null,
    homeYellowCards: 2,
    awayYellowCards: 1,
    homeRedCards: 0,
    awayRedCards: 1,
    goals: [
      { minute: 22, playerName: "H. Kane", teamSide: "home", type: "PENALTY" },
      { minute: 45, playerName: "K. Mbappé", teamSide: "away", type: "REGULAR" },
      { minute: 58, playerName: "J. Bellingham", teamSide: "home", type: "REGULAR" },
    ],
    kickoffTime: new Date(Date.now() - 67 * 60 * 1000).toISOString(),
    lastUpdated: now,
  });
  console.log("✅ Seeded fake-live-001  →  ENG 2–1 FRA  (LIVE 67')");

  // ── Match B: FINISHED knockout (decided on pens) ─────────────────────────
  // Brazil (home) 1 – 1 Germany (away) after 90+ET, Brazil wins 4-3 on pens
  // Goals: Vinicius Jr 34' / Müller 78'
  // HT: 1-0. Pens: 4-3 Brazil.
  await db.collection("matches").doc("fake-finished-pens-001").set({
    homeTeamId: "BRA",
    awayTeamId: "GER",
    homeScore: 1,
    awayScore: 1,
    status: "FINISHED",
    isLive: false,
    stage: "QF",
    group: null,
    minute: null,
    homeScoreHT: 1,
    awayScoreHT: 0,
    homeScorePens: 4,
    awayScorePens: 3,
    winner: "HOME",
    homeYellowCards: 1,
    awayYellowCards: 3,
    homeRedCards: 0,
    awayRedCards: 0,
    goals: [
      { minute: 34, playerName: "Vinícius Jr", teamSide: "home", type: "REGULAR" },
      { minute: 78, playerName: "T. Müller", teamSide: "away", type: "REGULAR" },
    ],
    kickoffTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    lastUpdated: now,
  });
  console.log("✅ Seeded fake-finished-pens-001  →  BRA 1–1 GER  (FT · 4–3 on pens)");

  await admin.app().delete();
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("FAIL:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
