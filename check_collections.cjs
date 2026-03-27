const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function check() {
  const tSnap = await db.collection('transactions').where('type', '==', 'investment').limit(5).get();
  tSnap.forEach(d => console.log('Tx:', d.data()));
}
check().catch(console.error).finally(() => process.exit(0));
