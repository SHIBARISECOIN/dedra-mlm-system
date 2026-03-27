import admin from 'firebase-admin';

// Copy the service account from check_data.js
import fs from 'fs';
const checkData = fs.readFileSync('check_data.js', 'utf8');
const saMatch = checkData.match(/const serviceAccount = \{[\s\S]*?\};/);
if (saMatch) {
  eval(saMatch[0]);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  const db = admin.firestore();
  
  async function run() {
    const users = await db.collection('users').get();
    let maxTxs = 0;
    for (const u of users.docs) {
      const txs = await db.collection('transactions').where('userId', '==', u.id).count().get();
      if (txs.data().count > maxTxs) maxTxs = txs.data().count;
    }
    console.log("Max transactions for a single user:", maxTxs);
  }
  run().catch(console.error);
}
