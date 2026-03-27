const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function setMode() {
  await db.collection('settings').doc('rates').update({
    rankGapMode: 'overlap'
  });
  console.log("Updated rankGapMode to 'overlap'");
}

setMode().catch(console.error).finally(() => process.exit(0));
