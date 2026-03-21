const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').where('email', '==', 'eunyeonghan1@gmail.com').get();
  console.log(users.docs[0].data());
  process.exit(0);
}
run();
