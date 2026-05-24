export {};
async function main() {
  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const snap = await db.collection("leaderboard").get();
  if (snap.empty) { console.log("leaderboard collection is empty"); return; }
  snap.forEach((doc) => {
    console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
  });
}
main().catch(console.error);
