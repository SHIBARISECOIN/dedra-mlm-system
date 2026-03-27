const admin = require('firebase-admin');
const sa = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function check() {
  const txs = await db.collection('transactions').where('userId', '==', 'KM7pKoYx4lM2gUt1wKPgT2rl57M2').get();
  txs.forEach(doc => {
     let tx = doc.data();
     console.log(tx.createdAt ? tx.createdAt.toDate().toISOString() : 'no date', tx.type, tx.amount, tx.amountUsdt, tx.status);
  });
  process.exit(0);
}
check().catch(console.error);
