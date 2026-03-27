const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const invId = 'migrated_Nlq4CBNYjuPwX5wJBocmQGY6xht1_v3_1773848929898';
  const bonuses = await db.collection('bonuses')
    .where('investmentId', '==', invId)
    .where('settlementDate', '==', '2026-03-26')
    .get();
    
  bonuses.forEach(b => console.log('26th Bonus:', b.data().amountUsdt));
}
check().catch(console.error).finally(() => process.exit(0));
