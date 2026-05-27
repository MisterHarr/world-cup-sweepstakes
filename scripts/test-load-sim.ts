export {};

/**
 * scripts/test-load-sim.ts  —  Bundle 5: Concurrent load simulation
 *
 * Fires 30 concurrent `confirmFeaturedTeam` calls then 10 concurrent
 * `executeTransfer` calls against the local Firebase emulator.  Never
 * touches production.
 *
 * Usage (from repo root — starts emulators automatically):
 *   npm run test:load-sim
 *
 * Functions must be compiled first:
 *   cd functions && npm run build && cd ..
 */

/* eslint-disable no-console */

// ── Constants ─────────────────────────────────────────────────────────────────

const REGION = process.env.FUNCTIONS_REGION ?? "asia-southeast1";
const PROJECT_ID = process.env.FIREBASE_EMULATOR_PROJECT ?? "demo-worldcup-loadtest";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST ?? "127.0.0.1:5001";

const CONCURRENT_USERS = 30;
const TRANSFER_USERS = 10; // subset of the 30 who also do a transfer

// Firebase REST endpoints
const SIGNUP_URL =
  `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`;
const CONFIRM_URL =
  `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/confirmFeaturedTeam`;
const TRANSFER_URL =
  `http://${FUNCTIONS_HOST}/${PROJECT_ID}/${REGION}/executeTransfer`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function ms(startMs: number): string {
  return `${((Date.now() - startMs) / 1000).toFixed(2)}s`;
}

function randomSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Team seed ─────────────────────────────────────────────────────────────────
//
// 48 synthetic teams — 12 groups (A–L), one team of each tier (1–4) per group.
// This gives drawTierBalanced plenty of candidates regardless of which featured
// team the user picks and which groups get excluded by the uniqueness rule.

type SimTeam = { id: string; name: string; group: string; tier: number };

function buildTeamSeed(): SimTeam[] {
  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const teams: SimTeam[] = [];
  for (const g of groups) {
    for (const tier of [1, 2, 3, 4] as const) {
      teams.push({ id: `SIM_${g}${tier}`, name: `Sim ${g} T${tier}`, group: g, tier });
    }
  }
  return teams;
}

const SIM_TEAMS = buildTeamSeed();
const ALL_TEAM_IDS = SIM_TEAMS.map((t) => t.id);

// ── Auth emulator helpers ──────────────────────────────────────────────────────

async function signUpUser(idx: number): Promise<{ uid: string; idToken: string }> {
  const email = `loadsim.${idx}.${randomSuffix()}@sim.test`;
  const res = await fetch(SIGNUP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "P@ssw0rd!Load", returnSecureToken: true }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`signUp[${idx}] failed: ${JSON.stringify(json)}`);
  return { uid: String(json.localId), idToken: String(json.idToken) };
}

// ── Cloud Function callers ────────────────────────────────────────────────────

async function callConfirmFeaturedTeam(
  idToken: string,
  teamId: string
): Promise<Record<string, unknown>> {
  const res = await fetch(CONFIRM_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: { teamId } }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new Error(
      `confirmFeaturedTeam failed (${res.status}): ${JSON.stringify(json)}`
    );
  }
  return (json.result ?? json.data ?? json) as Record<string, unknown>;
}

async function callExecuteTransfer(
  idToken: string,
  dropTeamId: string,
  pickupTeamId: string
): Promise<Record<string, unknown>> {
  const res = await fetch(TRANSFER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: { dropTeamId, pickupTeamId } }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok || json.error) {
    throw new Error(
      `executeTransfer failed (${res.status}): ${JSON.stringify(json)}`
    );
  }
  return (json.result ?? json.data ?? json) as Record<string, unknown>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ── Safety guard ────────────────────────────────────────────────────────────
  if (!PROJECT_ID.startsWith("demo-")) {
    throw new Error(
      `Safety check: projectId must start with "demo-" (got ${PROJECT_ID}). ` +
        "This script must only run against the local emulator."
    );
  }

  // Point Admin SDK at emulators BEFORE initialising the app.
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  const adminMod = await import("../functions/node_modules/firebase-admin/lib/index.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = (adminMod.default ?? adminMod) as any;

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  const db = admin.firestore() as import("@google-cloud/firestore").Firestore;

  // ── Emulator liveness check ──────────────────────────────────────────────────
  // A quick Firestore write confirms the emulator is actually running before
  // we spin up 30 Auth users.
  try {
    await db.collection("_loadsim_probe").doc("ping").set({ ts: Date.now() });
    await db.collection("_loadsim_probe").doc("ping").delete();
  } catch {
    throw new Error(
      `Firestore emulator not reachable at ${FIRESTORE_HOST}. ` +
        "Run the emulators first: npm run emulators:start"
    );
  }

  console.log(
    `\n⚡  Load simulation  [project: ${PROJECT_ID}]\n` +
      `    concurrent confirmFeaturedTeam : ${CONCURRENT_USERS}\n` +
      `    concurrent executeTransfer     : ${TRANSFER_USERS}\n`
  );

  const totalStart = Date.now();

  // ── Phase 1: Seed teams + open transfer window ────────────────────────────
  console.log("Phase 1/7  Seeding 48 teams + transfer window…");
  let t = Date.now();

  const teamBatch = db.batch();
  for (const team of SIM_TEAMS) {
    teamBatch.set(db.collection("teams").doc(team.id), team, { merge: true });
  }
  teamBatch.set(
    db.collection("settings").doc("transferWindow"),
    {
      enabled: true,
      startsAt: admin.firestore.Timestamp.fromMillis(Date.now() - 10 * 60_000),
      endsAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 60_000),
      updatedAt: admin.firestore.Timestamp.now(),
    },
    { merge: true }
  );
  await teamBatch.commit();
  console.log(`           ✓ done (${ms(t)})\n`);

  // ── Phase 2: Sign up 30 users via Auth emulator ───────────────────────────
  console.log(`Phase 2/7  Signing up ${CONCURRENT_USERS} Auth emulator users…`);
  t = Date.now();

  const users = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, (_, i) => signUpUser(i))
  );
  console.log(`           ✓ ${users.length} users created (${ms(t)})\n`);

  // ── Phase 3: Seed Firestore user docs ─────────────────────────────────────
  console.log(`Phase 3/7  Seeding ${CONCURRENT_USERS} Firestore user docs…`);
  t = Date.now();

  const userBatch = db.batch();
  for (let i = 0; i < users.length; i++) {
    userBatch.set(db.collection("users").doc(users[i].uid), {
      uid: users[i].uid,
      displayName: `Load Sim User ${i}`,
      email: `loadsim.${i}@sim.test`,
      portfolio: [],
      totalScore: 0,
      remainingTransfers: 1,
      transferPenaltyPoints: 0,
      isAdmin: false,
      hasSeenReveal: false,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }
  await userBatch.commit();
  console.log(`           ✓ done (${ms(t)})\n`);

  // ── Phase 4: 30 concurrent confirmFeaturedTeam ────────────────────────────
  //
  // Each user picks a different T1 team as their featured team (cycling through
  // the 12 available T1 teams: SIM_A1 … SIM_L1).  Concurrent calls exercise
  // the Firestore transaction inside confirmFeaturedTeam for independence: every
  // user writes only their own doc, so there is no lock contention.
  console.log(`Phase 4/7  Firing ${CONCURRENT_USERS} confirmFeaturedTeam concurrently…`);
  t = Date.now();

  const t1Teams = SIM_TEAMS.filter((tm) => tm.tier === 1).map((tm) => tm.id);

  const confirmSettled = await Promise.allSettled(
    users.map((u, i) => callConfirmFeaturedTeam(u.idToken, t1Teams[i % t1Teams.length]))
  );

  const confirmFailed = confirmSettled.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );
  console.log(
    `           ${CONCURRENT_USERS - confirmFailed.length}/${CONCURRENT_USERS} succeeded  ` +
      `${confirmFailed.length > 0 ? `(${confirmFailed.length} FAILED)` : ""}  (${ms(t)})`
  );
  if (confirmFailed.length > 0) {
    confirmFailed.forEach((r) => console.error(`           ✗ ${String(r.reason)}`));
  }
  assert(
    confirmFailed.length === 0,
    `${confirmFailed.length} confirmFeaturedTeam call(s) failed`
  );

  // Verify portfolios
  const userSnaps = await Promise.all(
    users.map((u) => db.collection("users").doc(u.uid).get())
  );
  let portfolioErrors = 0;
  for (const snap of userSnaps) {
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const portfolio = Array.isArray(data.portfolio)
      ? (data.portfolio as Array<Record<string, unknown>>)
      : [];
    const featured = portfolio.filter((p) => p.role === "featured");
    const drawn = portfolio.filter((p) => p.role === "drawn");
    if (featured.length !== 1 || drawn.length !== 5) {
      console.error(
        `           ✗ User ${snap.id}: featured=${featured.length}, drawn=${drawn.length}`
      );
      portfolioErrors++;
    } else {
      // Verify drawn teams are from distinct groups
      const drawnGroupSet = new Set<string>();
      for (const p of drawn) {
        const team = SIM_TEAMS.find((tm) => tm.id === String(p.teamId));
        if (team) drawnGroupSet.add(team.group);
      }
      if (drawnGroupSet.size !== drawn.length) {
        console.error(
          `           ✗ User ${snap.id}: drawn teams not all from unique groups`
        );
        portfolioErrors++;
      }
    }
  }
  assert(portfolioErrors === 0, `${portfolioErrors} portfolio(s) invalid after confirm`);
  console.log(
    `           ✓ all ${CONCURRENT_USERS} portfolios valid (1 featured + 5 drawn, unique groups)\n`
  );

  // ── Phase 5: 10 concurrent executeTransfer ────────────────────────────────
  //
  // The first 10 users each drop their first drawn team and pick up a team not
  // already in their portfolio.  All 10 fire simultaneously; each operates on
  // its own user doc so lock contention is limited to the shared leaderboard
  // recompute write.
  console.log(`Phase 5/7  Firing ${TRANSFER_USERS} executeTransfer concurrently…`);
  t = Date.now();

  type TransferArg = {
    uid: string;
    idToken: string;
    dropTeamId: string;
    pickupTeamId: string;
  };

  const transferArgs: TransferArg[] = [];
  for (let i = 0; i < TRANSFER_USERS; i++) {
    const user = users[i];
    const data = (userSnaps[i].data() ?? {}) as Record<string, unknown>;
    const portfolio = (
      Array.isArray(data.portfolio) ? data.portfolio : []
    ) as Array<Record<string, unknown>>;
    const portfolioIds = new Set(portfolio.map((p) => String(p.teamId)));

    const firstDrawn = portfolio.find((p) => p.role === "drawn");
    assert(Boolean(firstDrawn), `User ${user.uid} has no drawn team to drop`);
    const dropTeamId = String(firstDrawn!.teamId);

    // Pick the first SIM team not currently in this user's portfolio
    const pickupTeamId = ALL_TEAM_IDS.find((id) => !portfolioIds.has(id));
    assert(
      Boolean(pickupTeamId),
      `No valid pickup team found for user ${user.uid} — pool exhausted`
    );

    transferArgs.push({ uid: user.uid, idToken: user.idToken, dropTeamId, pickupTeamId: pickupTeamId! });
  }

  const transferSettled = await Promise.allSettled(
    transferArgs.map((a) => callExecuteTransfer(a.idToken, a.dropTeamId, a.pickupTeamId))
  );

  const transferFailed = transferSettled.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );
  console.log(
    `           ${TRANSFER_USERS - transferFailed.length}/${TRANSFER_USERS} succeeded  ` +
      `${transferFailed.length > 0 ? `(${transferFailed.length} FAILED)` : ""}  (${ms(t)})`
  );
  if (transferFailed.length > 0) {
    transferFailed.forEach((r) => console.error(`           ✗ ${String(r.reason)}`));
  }
  assert(
    transferFailed.length === 0,
    `${transferFailed.length} executeTransfer call(s) failed`
  );

  // Verify remainingTransfers decremented (seeded at 1, should now be 0)
  const transferSnaps = await Promise.all(
    transferArgs.map((a) => db.collection("users").doc(a.uid).get())
  );
  let transferErrors = 0;
  for (const snap of transferSnaps) {
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    const remaining = Number(data.remainingTransfers);
    if (remaining !== 0) {
      console.error(
        `           ✗ User ${snap.id}: remainingTransfers=${remaining} (expected 0)`
      );
      transferErrors++;
    }
  }
  assert(
    transferErrors === 0,
    `${transferErrors} user(s) had incorrect remainingTransfers after transfer`
  );
  console.log(
    `           ✓ all ${TRANSFER_USERS} users: remainingTransfers 1→0\n`
  );

  // ── Phase 6: Leaderboard consistency check ────────────────────────────────
  console.log("Phase 6/7  Checking leaderboard consistency…");
  t = Date.now();

  const lbSnap = await db.collection("leaderboard").doc("current").get();
  assert(lbSnap.exists, "leaderboard/current does not exist after transfers");

  const lbData = (lbSnap.data() ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(lbData.rows)
    ? (lbData.rows as Array<Record<string, unknown>>)
    : [];
  const lbUids = new Set(rows.map((r) => String(r.userId)));
  const missingFromLb = transferArgs.filter((a) => !lbUids.has(a.uid));
  assert(
    missingFromLb.length === 0,
    `${missingFromLb.length} transfer user(s) missing from leaderboard/current`
  );
  console.log(
    `           ✓ leaderboard has ${rows.length} rows; all ${TRANSFER_USERS} transfer users present (${ms(t)})\n`
  );

  // ── Phase 7: Cleanup ──────────────────────────────────────────────────────
  console.log(`Phase 7/7  Cleaning up ${CONCURRENT_USERS} users…`);
  t = Date.now();

  // Delete Firestore user docs in batches of 400
  const deleteBatch = db.batch();
  for (const user of users) {
    deleteBatch.delete(db.collection("users").doc(user.uid));
  }
  await deleteBatch.commit();

  // Delete transfer events for the 10 transfer users
  for (const arg of transferArgs) {
    const eventsSnap = await db
      .collection("transferEvents")
      .where("uid", "==", arg.uid)
      .get();
    if (!eventsSnap.empty) {
      const evBatch = db.batch();
      eventsSnap.docs.forEach((d) => evBatch.delete(d.ref));
      await evBatch.commit();
    }
  }

  // Delete Auth emulator users via Admin SDK
  await Promise.allSettled(
    users.map((u) => admin.auth().deleteUser(u.uid))
  );

  console.log(`           ✓ ${users.length} users deleted (${ms(t)})\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalSec = ((Date.now() - totalStart) / 1000).toFixed(2);
  console.log("══════════════════════════════════════════════════════");
  console.log(`PASS  Load simulation complete in ${totalSec}s`);
  console.log(`  Phase 4: ${CONCURRENT_USERS} concurrent confirmFeaturedTeam — all succeeded`);
  console.log(`  Phase 5: ${TRANSFER_USERS} concurrent executeTransfer — all succeeded (remainingTransfers 1→0)`);
  console.log(`  Phase 6: leaderboard consistent`);
  console.log(`  Phase 7: all ${CONCURRENT_USERS} mock users cleaned up`);
  console.log("══════════════════════════════════════════════════════\n");

  await admin.app().delete();
}

main().catch((err) => {
  console.error("\nFAIL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
