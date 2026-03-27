const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const bSnap = await db.collection('bonuses')
    .where('userId', '==', 'GnfPCaAcRrMGRyfJrN7JlfRFUaw1') // btc100
    .where('settlementDate', '==', '2026-03-26')
    .get();
  
  let count = 0;
  let total = 0;
  bSnap.forEach(b => {
    count++;
    total += b.data().amountUsdt || 0;
  });
  console.log(`btc100 26th bonuses: ${count} count, ${total} USDT`);
}
check().catch(console.error).finally(() => process.exit(0));
