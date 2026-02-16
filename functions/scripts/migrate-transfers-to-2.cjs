#!/usr/bin/env node

/**
 * Migration Script: Update remainingTransfers from 3 to 2
 *
 * Run with: node functions/scripts/migrate-transfers-to-2.cjs
 */

const admin = require("firebase-admin");
const serviceAccount = require("../service-account-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateTransfers() {
  console.log("🔍 Fetching all users...");

  const usersSnapshot = await db.collection("users").get();

  if (usersSnapshot.empty) {
    console.log("✅ No users found.");
    return;
  }

  console.log(`📊 Found ${usersSnapshot.size} users`);

  let updatedCount = 0;
  let skippedCount = 0;

  const batch = db.batch();

  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    const currentTransfers = data.remainingTransfers;

    if (currentTransfers === 3) {
      console.log(`  ✏️  Updating ${doc.id} (${data.displayName}): 3 → 2 transfers`);
      batch.update(doc.ref, { remainingTransfers: 2 });
      updatedCount++;
    } else {
      console.log(`  ⏭️  Skipping ${doc.id} (${data.displayName}): already ${currentTransfers} transfers`);
      skippedCount++;
    }
  });

  if (updatedCount > 0) {
    console.log(`\n💾 Committing ${updatedCount} updates...`);
    await batch.commit();
    console.log("✅ Migration complete!");
  } else {
    console.log("\n✅ No updates needed - all users already have correct transfer count.");
  }

  console.log(`\n📈 Summary:`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total: ${usersSnapshot.size}`);
}

migrateTransfers()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
