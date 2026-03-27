const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const tId = 'C6ScghFngss9VNq4r2ck'; // 장영숙님의 txId
  const t = await db.collection('transactions').doc(tId).get();
  console.log(t.data());
}

run().catch(console.error).finally(() => process.exit(0));
