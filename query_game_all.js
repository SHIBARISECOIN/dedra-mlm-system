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
  
  // 1. Check ALL game logs again (maybe different collection name or case?)
  const cols = await db.listCollections();
  console.log("Collections:", cols.map(c => c.id).join(', '));
  
  const games = await db.collection('game_logs').where('userId', '==', uid).get();
  console.log(`Found ${games.size} game logs for this user`);
  games.forEach(doc => console.log(doc.data()));
  
  // 2. Check general audit logs
  const audits = await db.collection('audit_logs').where('userId', '==', uid).get();
  console.log(`Found ${audits.size} audit logs for this user`);
  audits.forEach(doc => console.log(doc.data()));
  
  // 3. Let's see if he received abnormal bonus transfers
  const txs = await db.collection('transactions').where('userId', '==', uid).get();
  txs.forEach(doc => {
      const d = doc.data();
      if (d.type !== 'withdrawal') {
          console.log(`[${d.createdAt?.toDate?.()}] Type: ${d.type}, Amount: ${d.amount}`);
      }
  });
}

check().then(() => process.exit(0)).catch(console.error);
