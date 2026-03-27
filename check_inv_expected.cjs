const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const invs = await db.collection('investments').limit(5).get();
  invs.forEach(d => console.log('expectedReturn:', d.data().expectedReturn, 'amount:', d.data().amountUsdt, 'roi:', d.data().roiPercent));
}
check().catch(console.error).finally(() => process.exit(0));
