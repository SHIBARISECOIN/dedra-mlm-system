const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const doc = await db.collection('investments').doc('migrated_1gdQH0B25jM89f0KRgSZyXehOBt2_v3_1773849035305').get();
  console.log('amountUsdt:', doc.data().amountUsdt);
}
check().catch(console.error).finally(() => process.exit(0));
