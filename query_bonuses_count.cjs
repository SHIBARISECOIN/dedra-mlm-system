const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const bonuses = await db.collection('bonuses')
    .where('settlementDate', '==', '2026-03-26')
    .get();
    
  console.log("Total bonuses for 2026-03-26:", bonuses.size);
  const settlements = await db.collection('settlements').doc('2026-03-26').get();
  console.log("Settlement record:", settlements.exists ? settlements.data() : "Not found");
}

check().catch(console.error).finally(() => process.exit(0));
