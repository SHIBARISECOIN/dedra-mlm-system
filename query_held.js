import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const txs = await db.collection('transactions').where('status', '==', 'held').get();
  console.log(`Found ${txs.size} held transactions.`);
  txs.forEach(doc => {
      const d = doc.data();
      console.log(`User: ${d.userId}, Amount: ${d.amount}, Date: ${d.createdAt?.toDate?.()}`);
  });
}

check().then(() => process.exit(0)).catch(console.error);
