const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('users').limit(5).get();
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data().username, 'selfInvest:', doc.data().selfInvest, 'networkSales:', doc.data().networkSales);
  });
}
run().then(() => process.exit(0)).catch(console.error);
