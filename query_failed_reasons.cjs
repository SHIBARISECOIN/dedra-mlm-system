const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkTxs() {
  const snaps = await db.collection('transactions')
    .where('type', '==', 'withdrawal')
    .where('status', 'in', ['processing', 'failed'])
    .get();
    
  console.log(`Found ${snaps.size} withdrawals in processing/failed state:`);
  snaps.forEach(d => {
    const data = d.data();
    console.log(`- ID: ${d.id}, Memo: ${data.adminMemo || 'None'}`);
  });
}

checkTxs().catch(console.error).finally(() => process.exit(0));
