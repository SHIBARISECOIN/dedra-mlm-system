const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const invId = 'migrated_Nlq4CBNYjuPwX5wJBocmQGY6xht1_v3_1773848929898';
  const invDoc = await db.collection('investments').doc(invId).get();
  const inv = invDoc.data();
  console.log('Current inv:', inv);

  const bonuses = await db.collection('bonuses')
    .where('investmentId', '==', invId)
    .where('type', '==', 'roi')
    .get();
    
  bonuses.forEach(b => {
    const data = b.data();
    console.log(`Date: ${data.settlementDate}, ROI: ${data.amountUsdt}`);
  });
}
check().catch(console.error).finally(() => process.exit(0));
