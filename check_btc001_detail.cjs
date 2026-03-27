const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const configDoc = await db.collection('system').doc('config').get();
  console.log("Config:", configDoc.data());

  const uid = 'pgUN1pS3cSUwzPYc5DjHKMZWIbE2'; // btc001
  const bonuses = await db.collection('bonuses')
    .where('userId', '==', uid)
    .where('settlementDate', '==', '2026-03-26')
    .get();
    
  let rankCount = 0;
  let rankSum = 0;
  bonuses.forEach(b => {
    const d = b.data();
    if (d.type === 'rank_bonus') {
      rankCount++;
      rankSum += d.amountUsdt || 0;
    }
  });
  console.log(`btc001 rank bonuses: ${rankCount} count, ${rankSum} USDT`);
}

check().catch(console.error).finally(() => process.exit(0));
