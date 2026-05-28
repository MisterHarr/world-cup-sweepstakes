/**
 * Resets a user's entry so they can pick teams again.
 * Clears: entry, portfolio, hasSeenReveal
 * Preserves: displayName, email, username, isAdmin, totalScore, etc.
 *
 * Usage:
 *   npx tsx scripts/reset-user-entry.ts <uid>
 */
export {};

async function main() {
  const uid = process.argv[2]?.trim();
  if (!uid) {
    console.error("Usage: reset-user-entry.ts <uid>");
    process.exit(1);
  }

  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const sa = require("../service-account.json");
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

  const db = admin.firestore();
  const { FieldValue } = await import("../functions/node_modules/firebase-admin/lib/firestore/index.js") as any;

  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    console.error(`No Firestore user doc found for uid=${uid}`);
    process.exit(1);
  }

  const data = snap.data() ?? {};
  console.log(`Resetting entry for: ${data.displayName ?? data.email ?? uid}`);
  console.log(`  entry:         ${JSON.stringify(data.entry ?? null)}`);
  console.log(`  portfolio:     ${JSON.stringify((data.portfolio ?? []).length)} teams`);
  console.log(`  hasSeenReveal: ${data.hasSeenReveal ?? false}`);

  await userRef.update({
    entry: FieldValue.delete(),
    portfolio: [],
    hasSeenReveal: false,
  });

  console.log("\n✅ Done. User can now pick their Star Team again.");
}

main().catch((e) => { console.error(e); process.exit(1); });
