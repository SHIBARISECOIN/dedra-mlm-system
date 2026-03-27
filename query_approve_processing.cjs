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
    .where('status', '==', 'processing')
    .get();
    
  console.log(`Found ${snaps.size} processing withdrawals.`);
  let count = 0;
  for (const docSnap of snaps.docs) {
    const data = docSnap.data();
    console.log(`- ID: ${docSnap.id}, User: ${data.userId}`);
  }
}

run().catch(console.error).finally(() => process.exit(0));
