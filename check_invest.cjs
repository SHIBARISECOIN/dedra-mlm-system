const admin = require('firebase-admin');
const sa = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function checkInvest() {
  const uid = 'KM7pKoYx4lM2gUt1wKPgT2rl57M2';
  const snapshot = await db.collection('investments').where('userId', '==', uid).get();
  
  let txs = [];
  snapshot.forEach(doc => {
    let tx = doc.data();
    txs.push({
      amount: tx.amount,
      status: tx.status,
      date: tx.createdAt ? tx.createdAt.toDate().toISOString() : 'N/A'
    });
  });
  
  console.table(txs);
  process.exit(0);
}
checkInvest().catch(console.error);
