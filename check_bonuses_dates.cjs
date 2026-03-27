const admin = require('firebase-admin');
const sa = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function checkBonuses() {
  const uid = 'KM7pKoYx4lM2gUt1wKPgT2rl57M2';
  const snapshot = await db.collection('bonuses').where('userId', '==', uid).get();
  
  let txs = [];
  snapshot.forEach(doc => {
    let tx = doc.data();
    txs.push({
      type: tx.type,
      amount: tx.amount,
      date: tx.createdAt ? tx.createdAt.toDate().toISOString() : 'N/A'
    });
  });
  
  txs.sort((a,b) => a.date.localeCompare(b.date));
  console.log(`Found ${txs.length} bonuses.`);
  console.table(txs.slice(-10)); // last 10
  
  process.exit(0);
}
checkBonuses().catch(console.error);
