export {};
async function main() {
  const adminModule = await import("../functions/node_modules/firebase-admin/lib/index.js");
  const admin = (adminModule.default ?? adminModule) as typeof import("firebase-admin");
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const sa = require("../service-account.json");
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
  const snap = await admin.firestore().collection("users").get();
  snap.forEach((d) => {
    console.log(`\n--- ${d.id} ---`);
    console.log(JSON.stringify(d.data(), null, 2));
  });
}
main().catch(console.error);
