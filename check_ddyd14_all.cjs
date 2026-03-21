const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').where('email', '==', 'eunyeonghan1@gmail.com').get();
  const uid = users.docs[0].id;
  const invs = await db.collection('investments').where('userId', '==', uid).get();
  invs.forEach(d => console.log(d.id, d.data().amount, typeof d.data().amount));
  
  const txs = await db.collection('transactions').where('userId', '==', uid).get();
  txs.forEach(d => console.log(d.id, d.data().type, d.data().amount, typeof d.data().amount));
  
  process.exit(0);
}
run();
