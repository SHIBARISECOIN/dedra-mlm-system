const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
async function check() {
  // Let's check 25th bonuses to see if investmentId was there
  const bSnap = await db.collection('bonuses').where('settlementDate', '==', '2026-03-25').where('type', '==', 'roi').limit(10).get();
  bSnap.forEach(d => console.log("25th ROI:", d.data().investmentId));
  
  // Also check if any investments have lastSettledAt = 2026-03-26
  const iSnap = await db.collection('investments').where('lastSettledAt', '>=', '2026-03-26').get();
  console.log("Investments stuck on 26th:", iSnap.size);
}
check().catch(console.error).finally(() => process.exit(0));
