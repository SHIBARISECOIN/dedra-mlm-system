const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const bonusesSnapshot = await db.collection('bonuses')
    .where('userId', '==', '2VF2A5O7hmM1H8IMJ9owvmcFWPF2')
    .where('settlementDate', '==', '2026-03-26')
    .get();
    
  console.log("Found bonuses:", bonusesSnapshot.size);
  bonusesSnapshot.forEach(doc => {
    const b = doc.data();
    if (b.type === 'rank_bonus' && b.reason.includes('강영준')) {
      console.log(`[${b.createdAt}]`, b.reason, b.amountUsdt);
    }
  });
}
check().catch(console.error).finally(() => process.exit(0));
