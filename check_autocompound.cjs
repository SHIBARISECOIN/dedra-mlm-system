const admin = require('firebase-admin');
const sa = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function check() {
  const user = await db.collection('users').doc('KM7pKoYx4lM2gUt1wKPgT2rl57M2').get();
  console.log('autoCompound:', user.data().autoCompound);
  
  const txs = await db.collection('transactions').where('userId', '==', 'KM7pKoYx4lM2gUt1wKPgT2rl57M2').get();
  txs.forEach(doc => {
     let tx = doc.data();
     if(tx.type === 'reinvest' || tx.type === 'auto_compound') {
        console.log('Reinvest TX:', tx.amount, tx.createdAt.toDate());
     }
  });
  
  process.exit(0);
}
check().catch(console.error);
