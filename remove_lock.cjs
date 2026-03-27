const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
async function remove() {
  await db.collection('settlements').doc('2026-03-26').delete();
  console.log("Lock removed");
}
remove().catch(console.error).finally(() => process.exit(0));
