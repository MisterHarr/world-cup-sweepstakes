/**
 * Purge all wcpseed Firebase Auth accounts.
 *
 * These are the test accounts created during seeding — their Firestore
 * documents were already deleted. This script removes the corresponding
 * Firebase Auth records so they no longer appear in the console.
 *
 * UIDs were extracted from the Firebase console on 2026-05-24.
 * Real accounts (jzharrison@pm.me, harrison.j@gardenschool.edu.my,
 * jason.harrison855@gmail.com) are NOT included.
 *
 * Usage:
 *   GCLOUD_PROJECT=worldcup-sweepstake-2026 npx tsx scripts/purge-seed-auth-users.ts
 */
export {};

// All 63 wcpseed Auth UIDs — sourced from Firebase console, 2026-05-24
const SEED_UIDS: string[] = [
  "2vS5EjzznLQ3LCfA7lfwS6s0FBm2", // wcpseed_60
  "Eul4zA96rnYfnxbIBHbrgR3acUk1", // wcpseed_59
  "rqjBGbill5OGJ8Uj48AvPpRc81p1", // wcpseed_58
  "Fl253dokibW9Ps4XOQ6cJ9EjmbV2", // wcpseed_56
  "pBj0CTmMh6N4tuGOstrJnr9KpwD3", // wcpseed_57
  "eq5OmLpNdmRpqBFeM28aef5cgoB3", // wcpseed_55
  "m2K9Icl7t4cxr8nQVQpnQDgJxEb2", // wcpseed_54
  "oP5C3CMYHIh9BmKKSvB7mHZsOZ03", // wcpseed_53
  "R6AqUKQD8yPmSCu2qdr27NrMR7s1", // wcpseed_52
  "KvDde4CeBLfiSQlfUH9kw0A8SLT2", // wcpseed_51
  "sMG7UEe7gobWBhUgk1JmOaI9yDW2", // wcpseed_50
  "ECg9oSpQFpNTcaYEtJusCiBmWc12", // wcpseed_48
  "yVXhwTzGAOYl3UCIh4OffbBIvkJ3", // wcpseed_49
  "MkG1uhq1L4UAXMH2eWA5HTSXkj63", // wcpseed_47
  "eJynODsMBgaHDhKlg9bMNXBYTSp1", // wcpseed_46
  "EMbeF345jGTegPH5rGuCrxM4Ck43", // wcpseed_45
  "MK3irllwPGNXU9G77OP1t6dWYNu2", // wcpseed_44
  "Dy5Ikb1bjfQ2y7NmFK6qQxwzzHM2", // wcpseed_43
  "DZQQJOp54Xc3v5OMA0Whv9Gsfsj2", // wcpseed_42
  "Hd61CQliHbhkLb3ZjoCMHJgwqzp2", // wcpseed_41
  "7PcqFL99QHUkIg0d9xawcx2BTmx1", // wcpseed_40
  "x0YSGAU9DHhX7Om6aklmonSxpcH2", // wcpseed_39
  "SXZs86pugjMyWRXulrr0ATjBgf12", // wcpseed_38
  "p8gnsz31q7PEOvgMoJMe6Sb1Fi63", // wcpseed_37
  "Uew9pq11X1RD2R9g6lw3HAvJTDQ2", // wcpseed_36
  "kvYtaw6coTSjvzl9WgG0nUgjxwF3", // wcpseed_35
  "gIiwXxSlGsUVPcOmH0SAbpTSHd83", // wcpseed_34
  "uGZlGvcU5KR9u09yoscIkgwrJDH3", // wcpseed_33
  "mwiKSoT6KFbkVQyiCBD9vKXRBx82", // wcpseed_32
  "KengsDvzrld5SpDQ3lHJpkXQ5ZJ3", // wcpseed_31
  "35ZdeP1MHoOW1WSFXImCVYTbElw2", // wcpseed_30
  "5MBSXLYG6AcuBZJsuMlq0PCiWJk2", // wcpseed_29
  "X6acA6TUUxS5f8MzMaOaZwlZ0Th2", // wcpseed_28
  "kqKN9LfbQyRpoHXQwyH8x8ybvxR2", // wcpseed_27
  "478O48g5bKX4qZnjndOxJmn6zRG3", // wcpseed_26
  "0xCfEVDNMuXeS2JwhQxE9oIMkT82", // wcpseed_25
  "UANKPMwNTdMNO1BteOQi7n0FMvR2", // wcpseed_24
  "H4zfep4bA8VxuCQsxvSP5nGAclk1", // wcpseed_23
  "GfOH1vPUmNcgOqRizeEcUhWOyp53", // wcpseed_22
  "ebAKhGAyWLQ20m9r9DYL7YzebR42", // wcpseed_21
  "lFA9FPn9FHY8XQvtF8yBepi6Co73", // wcpseed_20
  "xkpGI1fxuUSxrIMSF5UwVHNYs6D2", // wcpseed_19
  "ucYgh91oX0bRIBsGUUm0nzbcZcv2", // wcpseed_18
  "tLvhta8HZiThUkjESWK3u2dwQjw2", // wcpseed_17
  "m2SkcUVo13M37sSGVldbTkI5cl42", // wcpseed_16
  "9Q7MzejDNFYioAV9tNvq0UkwgSQ2", // wcpseed_15
  "CKmaqAI6LpW5C4Mp98b8SMGmRGB3", // wcpseed_14
  "NksqlU1GSzg7xwR8wNZYC444ffA2", // wcpseed_13
  "hAZnX5UQA4bBHY8ZvRwdIN15llm2", // wcpseed_12
  "gE4E8tHtahShQ3HrCPiqzyHRjBv2", // wcpseed_11
  "H60I8IAabKSDTcPYEjgmHihbNW32", // wcpseed_09
  "vAbjSws3Tph68jTqHJ1DUYZgJgl2", // wcpseed_10
  "gefwjrUZVDPbqQol5AesIOY2AHw2", // wcpseed_08
  "jwP3FFvMjKMXdndLiUu79rWMuaH3", // wcpseed_07
  "fitxdIBVypZrKtq9NkJRWO8asLB3", // wcpseed_06
  "5gEqaXbZECQ3b5Yt4myhKSweLth2", // wcpseed_05
  "99y3sINsvscwpavFkWyx3v0fXkB3", // wcpseed_04
  "KyPDwyarJzgm6bqPNEo3pDZfadm1", // wcpseed_03
  "0L2R3vzhlIbfGhqJ14F2R8Z8gHf1", // wcpseed_02
  "XUTZb3xTaZfPmTYBd7gnD6eeLfw2", // wcpseed_01
  "3l6KcNRkVUTQZXIkvdH9IFKnxsa2", // wcpseed_2 (Feb batch)
  "tBjfUc3MvyPB7x2ZH7uUCgpk6rt1", // wcpseed_2 (Feb batch)
  "Mty0edZD13ViTIbWlrl75kfKZGl1", // wcpseed_1 (Feb batch)
];

async function main() {
  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  console.log(`🗑️  Deleting ${SEED_UIDS.length} seed Auth accounts…`);

  // deleteUsers supports up to 1000 UIDs per call
  const result = await admin.auth().deleteUsers(SEED_UIDS);

  console.log(`✅ Successfully deleted: ${result.successCount}`);
  if (result.failureCount > 0) {
    console.warn(`⚠️  Failed to delete: ${result.failureCount}`);
    result.errors.forEach((e) => {
      console.warn(`   UID ${e.index} (${SEED_UIDS[e.index]}): ${e.error.message}`);
    });
  }
  console.log("Done. Refresh Firebase console to confirm.");
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
