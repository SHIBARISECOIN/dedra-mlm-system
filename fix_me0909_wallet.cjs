const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uSnap = await db.collection('users').where('username', '==', 'me0909').get();
  if(!uSnap.empty) {
    const uid = uSnap.docs[0].id;
    const wRef = db.collection('wallets').doc(uid);
    const wSnap = await wRef.get();
    if(wSnap.exists) {
        const d = wSnap.data();
        console.log("me0909 wallet:", d);
        if (d.totalWithdrawal < 0) {
            await wRef.update({
                bonusBalance: d.totalEarnings || 0,
                totalWithdrawal: 0
            });
            console.log("Fixed me0909 wallet too.");
        }
    }
  }
}
run().catch(console.error).finally(() => process.exit(0));
