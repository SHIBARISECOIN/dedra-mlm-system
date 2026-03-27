const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  // Is it possible the wallet had negative balance or he had manual adjustment?
  const manualTxSnap = await db.collection('transactions').where('type', '==', 'manual_adjust').get();
  manualTxSnap.forEach(d => {
      const tx = d.data();
      if(tx.userId === uid || tx.userEmail === 'hsy7948@deedra.com') {
          console.log("Manual Adjust for user:", tx);
      }
  });
}
run().catch(console.error).finally(() => process.exit(0));
