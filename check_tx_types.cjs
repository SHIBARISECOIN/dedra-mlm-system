const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const txSnap = await db.collection('transactions')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const types = {};
  txSnap.forEach(doc => {
      const t = doc.data().type || 'undefined';
      types[t] = (types[t] || 0) + 1;
  });
  console.log(types);
}
run().catch(console.error).finally(() => process.exit(0));
