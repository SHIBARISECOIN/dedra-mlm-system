const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function check() {
  const doc = await db.collection('settings').doc('rates').get();
  console.log(doc.data());
  process.exit(0);
}
check();
