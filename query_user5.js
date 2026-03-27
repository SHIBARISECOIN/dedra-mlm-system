import admin from 'firebase-admin';
import fs from 'fs';

const saStr = fs.readFileSync('sa.js', 'utf8');
const saMatch = saStr.match(/const serviceAccount = (\{[\s\S]*?\});/);
const serviceAccount = JSON.parse(saMatch[1].replace(/([a-zA-Z0-9_]+):/g, '"$1":').replace(/'/g, '"').replace(/\n/g, ''));

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
