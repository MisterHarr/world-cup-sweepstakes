#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

/**
 * Firestore security rules unit tests — Bundle 4.
 *
 * Runs against the local Firestore emulator. Launch via:
 *   npm run test:rules              (from repo root — starts emulator automatically)
 *   npm run test:emulator:rules     (from functions/ — emulator must already be running)
 *
 * Covers:
 *   /users/{uid}           — read, create, update rules
 *   /usernames/{username}  — claim, delete, update rules (Bundle 3 collection)
 *   admin-only collections — matches, leaderboard, teams, settings
 *   /potEntries/{uid}      — open/locked/deadline/field-list/status/read rules (Phase 1)
 *   catch-all              — all other paths denied
 */

const { initializeTestEnvironment, assertFails, assertSucceeds } =
  require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } =
  require("@firebase/firestore");
const { readFileSync } = require("fs");
const path = require("path");

const RULES_PATH = path.resolve(__dirname, "../../firestore.rules");
const PROJECT_ID = process.env.FIREBASE_EMULATOR_PROJECT || "demo-worldcup-loadtest";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [firestoreHost, firestorePort] = FIRESTORE_HOST.split(":");

// ── Simple test runner ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${name}`);
    console.error(`        ${msg.split("\n")[0]}`);
    failed++;
    failures.push({ name, message: msg });
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!PROJECT_ID.startsWith("demo-")) {
    throw new Error(`Safety check: projectId must start with "demo-" (got ${PROJECT_ID})`);
  }

  console.log(`\n🔒  Firestore rules unit tests  [project: ${PROJECT_ID}]\n`);

  const rules = readFileSync(RULES_PATH, "utf8");

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: firestoreHost,
      port: Number(firestorePort) || 8080,
    },
  });

  const UID = "rules-test-user-001";
  const OTHER_UID = "rules-test-user-002";

  // Minimal valid user-create document (matches isUserCreateValid in rules).
  const validCreateDoc = {
    uid: UID,
    displayName: "Test User",
    email: "test@rules.test",
    portfolio: [],
    totalScore: 0,
    remainingTransfers: 2,
    transferPenaltyPoints: 0,
    isAdmin: false,
    hasSeenReveal: false,
    updatedAt: serverTimestamp(),
  };

  // ── /users/{uid} ────────────────────────────────────────────────────────────
  console.log("  ── /users/{uid} ──");

  await test("Unauthenticated read is rejected", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users", UID)));
  });

  await test("Authenticated user can read their own doc", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(getDoc(doc(db, "users", UID)));
  });

  await test("Authenticated user cannot read another user's doc", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, "users", UID)));
  });

  await test("Authenticated user can create their own doc with valid fields", async () => {
    await testEnv.clearFirestore();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, "users", UID), validCreateDoc));
  });

  await test("Create is rejected if totalScore != 0", async () => {
    await testEnv.clearFirestore();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "users", UID), { ...validCreateDoc, totalScore: 5 }));
  });

  await test("Create is rejected if remainingTransfers != 2", async () => {
    await testEnv.clearFirestore();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "users", UID), { ...validCreateDoc, remainingTransfers: 1 }));
  });

  await test("Create is rejected if isAdmin == true", async () => {
    await testEnv.clearFirestore();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "users", UID), { ...validCreateDoc, isAdmin: true }));
  });

  await test("Create is rejected if portfolio is non-empty", async () => {
    await testEnv.clearFirestore();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(
      setDoc(doc(db, "users", UID), {
        ...validCreateDoc,
        portfolio: [{ teamId: "T1", role: "featured" }],
      })
    );
  });

  await test("Create is rejected if unknown fields are present", async () => {
    await testEnv.clearFirestore();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(
      setDoc(doc(db, "users", UID), { ...validCreateDoc, secretField: "oops" })
    );
  });

  // Seed an existing doc via Admin bypass so we can test update rules.
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", UID), {
      uid: UID,
      displayName: "Original Name",
      email: "original@rules.test",
      portfolio: [{ teamId: "T1", role: "featured" }],
      totalScore: 10,
      remainingTransfers: 2,
      transferPenaltyPoints: 0,
      isAdmin: false,
      hasSeenReveal: false,
      updatedAt: serverTimestamp(),
    });
  });

  await test("User can update allowed fields (displayName, email, photoURL, hasSeenReveal, updatedAt)", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(
      updateDoc(doc(db, "users", UID), {
        displayName: "New Name",
        email: "new@rules.test",
        photoURL: "https://example.com/avatar.jpg",
        hasSeenReveal: true,
        updatedAt: serverTimestamp(),
      })
    );
  });

  await test("Update is rejected if portfolio is changed directly", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(
      updateDoc(doc(db, "users", UID), {
        portfolio: [],
        updatedAt: serverTimestamp(),
      })
    );
  });

  await test("Update is rejected if totalScore is changed", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(
      updateDoc(doc(db, "users", UID), {
        totalScore: 0,
        updatedAt: serverTimestamp(),
      })
    );
  });

  await test("Update is rejected if remainingTransfers is changed", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(
      updateDoc(doc(db, "users", UID), {
        remainingTransfers: 3,
        updatedAt: serverTimestamp(),
      })
    );
  });

  // ── /usernames/{username} ────────────────────────────────────────────────────
  console.log("\n  ── /usernames/{username} ──");

  const LOCK_NAME = "testuser";

  await testEnv.clearFirestore();

  await test("Authenticated user can claim a username (create with own uid)", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, "usernames", LOCK_NAME), { uid: UID }));
  });

  await test("Create is rejected if uid does not match request.auth.uid", async () => {
    await testEnv.clearFirestore();
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "usernames", LOCK_NAME), { uid: OTHER_UID }));
  });

  // Seed locks for delete tests.
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "usernames", LOCK_NAME), { uid: UID });
    await setDoc(doc(db, "usernames", "otherlock"), { uid: OTHER_UID });
  });

  await test("User can delete their own username lock", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(deleteDoc(doc(db, "usernames", LOCK_NAME)));
  });

  await test("User cannot delete another user's username lock", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(deleteDoc(doc(db, "usernames", "otherlock")));
  });

  // Seed lock for update test.
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "usernames", LOCK_NAME), { uid: UID });
  });

  await test("Direct update of username lock is rejected", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(updateDoc(doc(db, "usernames", LOCK_NAME), { uid: UID }));
  });

  // ── Admin-only collections ───────────────────────────────────────────────────
  console.log("\n  ── Admin-only collections ──");

  await testEnv.clearFirestore();

  await test("Authenticated non-admin cannot write to matches", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(
      setDoc(doc(db, "matches", "match1"), { homeTeamId: "T1", awayTeamId: "T2" })
    );
  });

  await test("Authenticated non-admin cannot write to leaderboard", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "leaderboard", "current"), { rows: [] }));
  });

  await test("Authenticated user can read matches (signed-in read allowed)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "matches", "match1"), {
        homeTeamId: "T1",
        awayTeamId: "T2",
        status: "SCHEDULED",
      });
    });
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(getDoc(doc(db, "matches", "match1")));
  });

  await test("Admin token can write to matches", async () => {
    const db = testEnv.authenticatedContext("admin-uid", { admin: true }).firestore();
    await assertSucceeds(
      setDoc(doc(db, "matches", "match-admin"), {
        homeTeamId: "T3",
        awayTeamId: "T4",
        status: "SCHEDULED",
      })
    );
  });

  // ── /potEntries/{uid} ───────────────────────────────────────────────────────
  console.log("\n  ── /potEntries/{uid} ──");

  // Valid self-declaration payload (must match the field allow-list in rules).
  const validPotEntry = {
    uid: UID,
    displayName: "Test User",
    code: "ABC123",
    selfDeclaredAt: serverTimestamp(),
    status: "pending",
    selfDeclared: true,
  };

  // 1 — No settings doc: entries are open by default (entriesOpen() returns true).
  await testEnv.clearFirestore();
  await test("potEntries: create succeeds when no settings/prizePot doc exists", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, "potEntries", UID), validPotEntry));
  });

  // 2 — Explicit potLocked: false: entries open.
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "settings", "prizePot"), { potLocked: false, open: true });
  });
  await test("potEntries: create succeeds when potLocked is false", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, "potEntries", UID), validPotEntry));
  });

  // 3 — potLocked: true: create must be rejected.
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "settings", "prizePot"), { potLocked: true, open: false });
  });
  await test("potEntries: create is rejected when potLocked is true", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "potEntries", UID), validPotEntry));
  });

  // 4 — Past entry deadline: create must be rejected.
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Deadline set 1 day in the past.
    const pastDeadline = Timestamp.fromMillis(Date.now() - 86_400_000);
    await setDoc(doc(db, "settings", "prizePot"), {
      potLocked: false,
      open: true,
      entryDeadline: pastDeadline,
    });
  });
  await test("potEntries: create is rejected when entryDeadline is in the past", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "potEntries", UID), validPotEntry));
  });

  // 5 — eligibleForPot field is not in the allow-list: client cannot set it.
  await testEnv.clearFirestore();
  await test("potEntries: create is rejected if eligibleForPot is included (field not in allow-list)", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(
      setDoc(doc(db, "potEntries", UID), { ...validPotEntry, eligibleForPot: true })
    );
  });

  // 6 — status must be "pending"; "confirmed" must be rejected.
  await testEnv.clearFirestore();
  await test("potEntries: create is rejected if status is 'confirmed'", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(
      setDoc(doc(db, "potEntries", UID), { ...validPotEntry, status: "confirmed" })
    );
  });

  // 7 — Confirmed entry is readable by any signed-in user.
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "potEntries", UID), {
      uid: UID,
      displayName: "Test User",
      status: "confirmed",
      eligibleForPot: true,
    });
  });
  await test("potEntries: confirmed entry is readable by another signed-in user", async () => {
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertSucceeds(getDoc(doc(db, "potEntries", UID)));
  });

  // ── Catch-all ────────────────────────────────────────────────────────────────
  console.log("\n  ── Catch-all ──");

  await test("Unknown collection read is denied (authenticated)", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(getDoc(doc(db, "notACollection", "doc1")));
  });

  await test("Unknown collection write is denied (authenticated)", async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(setDoc(doc(db, "notACollection", "doc1"), { data: "bad" }));
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  await testEnv.cleanup();

  const total = passed + failed;
  console.log(`\n${total} tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error("\nFailed tests:");
    failures.forEach((f) => console.error(`  ✗  ${f.name}`));
    process.exit(1);
  }

  console.log("\nPASS: Firestore rules security tests succeeded.");
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
