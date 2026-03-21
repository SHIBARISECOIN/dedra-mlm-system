const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const wRef = db.collection('wallets').doc('qAdGKU772oVGZ0B5PwUEbL3UqSF3');
  const doc = await wRef.get();
  console.log(doc.data());
}

run().catch(console.error);
