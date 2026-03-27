const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function checkOdds() {
  const doc = await db.collection('settings').doc('gameOdds').get();
  console.log('Current DB state:', doc.data());
  process.exit(0);
}

checkOdds();
