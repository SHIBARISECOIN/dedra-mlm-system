const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const users = ['pks2237', 'cws3410'];
  for (const un of users) {
    const usersSnap = await db.collection('users').where('username', '==', un).get();
    if (usersSnap.empty) continue;
    const uid = usersSnap.docs[0].id;
    const wDoc = await db.collection('wallets').doc(uid).get();
    console.log(`User ${un} USDT Balance:`, wDoc.data()?.usdtBalance);
  }
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
