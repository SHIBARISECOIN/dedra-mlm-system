const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function updateCron() {
  await db.collection('settings').doc('rates').update({
    autoSettlementMinute: 2
  });
  console.log('Updated autoSettlementMinute to 2 (12:02 AM KST / 15:02 UTC)');
  process.exit(0);
}
updateCron();
