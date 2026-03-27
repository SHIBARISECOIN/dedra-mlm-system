const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  const allTx = await db.collection('transactions').get();
  
  console.log(`\n[All transactions for ${uid}]`);
  allTx.forEach(doc => {
      const d = doc.data();
      if (d.userId === uid || d.userEmail === 'hsy7948@deedra.com') {
          console.log(doc.id, d.type, d.amount || d.amountUsdt, d.status);
      }
  });
}
run().catch(console.error).finally(() => process.exit(0));
