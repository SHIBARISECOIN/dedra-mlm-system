const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').where('email', '>=', 'eunyeong').where('email', '<=', 'eunyeong\uf8ff').get();
  users.forEach(d => console.log(d.id, d.data().username, d.data().email));
  const users2 = await db.collection('users').where('username', '>=', 'ddyd').where('username', '<=', 'ddyd\uf8ff').get();
  users2.forEach(d => console.log(d.id, d.data().username, d.data().email));
  process.exit(0);
}
run();
