const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const ratesDoc = await db.collection('settings').doc('rates').get();
  console.log("Rates:", ratesDoc.data());
}

check().catch(console.error).finally(() => process.exit(0));
