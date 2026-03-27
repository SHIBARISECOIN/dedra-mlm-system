const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const u = await db.collection('wallets').doc('pgUN1pS3cSUwzPYc5DjHKMZWIbE2').get();
  console.log("Current btc001 wallet:", u.data());
  
  const i = await db.collection('investments').where('userId', '==', 'pgUN1pS3cSUwzPYc5DjHKMZWIbE2').get();
  let tot = 0;
  i.forEach(doc => {
    tot += doc.data().amountUsdt || 0;
    console.log("Inv:", doc.data().amountUsdt, doc.data().lastSettledAt);
  });
  console.log("Investments total:", tot);
}
check().catch(console.error).finally(() => process.exit(0));
