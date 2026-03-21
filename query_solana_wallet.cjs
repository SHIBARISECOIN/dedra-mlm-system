const admin = require("firebase-admin");
try {
  const serviceAccount = require("../deedra-mlm-firebase-adminsdk-xxxxx.json");
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {
  admin.initializeApp();
}
const db = admin.firestore();

async function run() {
  const doc = await db.collection("settings").doc("companyWallets").get();
  console.log("Company Wallets:", JSON.stringify(doc.data(), null, 2));
}
run().catch(console.error).finally(()=>process.exit(0));
