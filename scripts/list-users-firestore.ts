export {};
async function main() {
  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const snap = await db.collection("users").get();
  snap.forEach((doc) => {
    const d = doc.data();
    console.log(JSON.stringify({
      uid: doc.id,
      displayName: d.displayName,
      email: d.email,
      totalPoints: d.totalPoints,
      remainingTransfers: d.remainingTransfers,
      teamId: d.teamId,
    }, null, 2));
  });
}
main().catch(console.error);
