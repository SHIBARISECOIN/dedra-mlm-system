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
    
  console.log("Total bonuses:", bonuses.size);
  const byUserAndType = {};
  
  bonuses.forEach(b => {
    const d = b.data();
    const key = `${d.userId}_${d.type}_${d.reason || ''}`;
    if (!byUserAndType[key]) byUserAndType[key] = 0;
    byUserAndType[key]++;
  });
  
  const dups = Object.entries(byUserAndType).filter(([k, v]) => v > 1);
  console.log("Duplicates:", dups.length);
  if (dups.length > 0) {
    console.log("Sample dups:", dups.slice(0, 5));
  }
}

check().catch(console.error).finally(() => process.exit(0));
