const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const hsy = await db.collection('users').doc('mb4hYj4bb8ZWzPs1sAu4zNTf0o02').get();
  console.log('HSY7948 data:', hsy.data()?.totalInvested, 'sponsor:', hsy.data()?.referredBy);
  const w = await db.collection('wallets').doc('mb4hYj4bb8ZWzPs1sAu4zNTf0o02').get();
  console.log('HSY wallet totalInvested:', w.exists ? w.data().totalInvested : 'no wallet');
  
  // also check cyj0300 downline tree to see exactly what changed
  const cyjDoc = await db.collection('users').doc('qAdGKU772oVGZ0B5PwUEbL3UqSF3').get();
  console.log('CYJ0300 current networkSales:', cyjDoc.data().networkSales);
  
  process.exit(0);
}
run();
