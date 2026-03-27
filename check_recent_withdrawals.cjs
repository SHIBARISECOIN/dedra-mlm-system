const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const txSnap = await db.collection('transactions')
    .orderBy('createdAt', 'desc')
    .limit(300)
    .get();

  let c = 0;
  txSnap.forEach(doc => {
      const d = doc.data();
      if (d.type === 'withdraw') {
        let t = 'Unknown';
        if (d.createdAt && d.createdAt.toDate) t = d.createdAt.toDate().toISOString();
        else if (d.createdAt && d.createdAt._seconds) t = new Date(d.createdAt._seconds*1000).toISOString();
        console.log(`[${t}] Tx: ${doc.id} | User: ${d.userEmail || d.userId} | Amt: ${d.amountUsdt || d.amount} | Status: ${d.status}`);
        c++;
      }
  });
  console.log("Total recent withdrawals:", c);
}
run().catch(console.error).finally(() => process.exit(0));
