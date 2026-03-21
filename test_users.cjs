const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const users = ['btc001', 'skili06'];
  for(const u of users) {
    const snap = await db.collection('users').where('username', '==', u).get();
    if(!snap.empty) {
      const data = snap.docs[0].data();
      console.log(u, 'totalInvested:', data.totalInvested, 'networkSales:', data.networkSales);
    }
  }
}
run().then(() => process.exit(0)).catch(console.error);
