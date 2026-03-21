const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const p = await db.collection('products').doc('vb7CsNewjaepbGZBCI3h').get();
  console.log(p.data());
  process.exit(0);
}
run();
