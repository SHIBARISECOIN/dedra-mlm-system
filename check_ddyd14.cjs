const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').where('email', '==', 'eunyeonghan1@gmail.com').get();
  if (users.empty) { console.log('no user'); return; }
  const uid = users.docs[0].id;
  const w = await db.collection('wallets').doc(uid).get();
  console.log('Wallet:', w.data());
  const invs = await db.collection('investments').where('userId', '==', uid).get();
  console.log('Investments:');
  invs.forEach(d => console.log(d.id, d.data()));
  process.exit(0);
}
run();
