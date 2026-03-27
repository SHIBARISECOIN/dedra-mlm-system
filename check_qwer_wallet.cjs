const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function run() {
  const w = await db.collection('wallets').doc('vQwsQjsoIgXICtBnHjbWsACd7nZ2').get();
  console.log('qwer78452 wallet:', w.data());
  process.exit(0);
}
run();
