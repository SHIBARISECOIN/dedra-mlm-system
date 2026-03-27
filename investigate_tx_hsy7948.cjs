const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  const txSnap = await db.collection('transactions').where('userId', '==', uid).get();
  
  let txs = [];
  txSnap.forEach(d => txs.push({id: d.id, ...d.data()}));
  
  // Sort in JS instead of Firestore to avoid missing index
  txs.sort((a, b) => {
      const aTime = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : a.createdAt._seconds*1000) : 0;
      const bTime = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : b.createdAt._seconds*1000) : 0;
      return bTime - aTime; // descending
  });

  console.log(`\n[Transactions: ${txs.length} total]`);
  txs.forEach(tx => {
      let t = 'Unknown';
      if (tx.createdAt && tx.createdAt.toDate) t = tx.createdAt.toDate().toISOString();
      else if (tx.createdAt && tx.createdAt._seconds) t = new Date(tx.createdAt._seconds*1000).toISOString();
      console.log(` - [${t}] Type: ${tx.type} | Amount: ${tx.amountUsdt || tx.amount || 0} | Status: ${tx.status || 'N/A'} | Note: ${tx.reason || tx.adminMemo || tx.memo || ''} | ID: ${tx.id}`);
  });
}
run().catch(console.error).finally(() => process.exit(0));
