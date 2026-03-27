const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const snaps = await db.collection('transactions')
    .where('type', '==', 'withdrawal')
    .where('status', '==', 'failed')
    .get();
    
  console.log(`Found ${snaps.size} failed withdrawals.`);
  let count = 0;
  for (const docSnap of snaps.docs) {
    const data = docSnap.data();
    if (data.adminMemo && data.adminMemo.includes('has expired')) {
      const match = data.adminMemo.match(/Signature ([A-Za-z0-9]+) has expired/);
      if (match) {
        const txid = match[1];
        console.log(`Fixing ${docSnap.id}: Setting status to approved, txid: ${txid}`);
        await docSnap.ref.update({
          status: 'approved',
          txid: txid,
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          adminMemo: 'Phantom 전송 완료 (자동 복구)'
        });
        count++;
      }
    }
  }
  console.log(`Fixed ${count} records.`);
}

run().catch(console.error).finally(() => process.exit(0));
