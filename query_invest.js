import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02'; // hsy7948
  
  const investments = await db.collection('investments').where('userId', '==', uid).get();
  console.log(`Found ${investments.docs.length} investments for this user.`);
  
  for (const doc of investments.docs) {
      console.log(`ID: ${doc.id}, Status: ${doc.data().status}, Amount: ${doc.data().amount || doc.data().amountUsdt}`);
      // Force cancel anyway
      await doc.ref.update({
          status: 'cancelled',
          amount: 0,
          amountUsdt: 0
      });
  }
}

check().then(() => process.exit(0)).catch(console.error);
