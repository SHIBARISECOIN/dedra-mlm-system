import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  const doc = await db.collection('users').doc(uid).get();
  console.log('USER DATA:', doc.data());
  
  const logs = await db.collection('audit_logs').where('userId', '==', uid).get();
  console.log(`\nFound ${logs.size} audit logs for user:`);
  logs.forEach(l => {
      const d = l.data();
      console.log(`- [${d.createdAt?.toDate?.()}] Action: ${d.action}, details:`, d.details);
  });
  
  const txs = await db.collection('transactions').where('userId', '==', uid).get();
  console.log(`\nFound ${txs.size} transactions for user:`);
  txs.forEach(l => {
      const d = l.data();
      console.log(`- [${d.createdAt?.toDate?.()}] Type: ${d.type}, amount: ${d.amount}, status: ${d.status}`);
  });
  
  // Look for any admin actions targeting this user
  const adminLogs = await db.collection('audit_logs').where('targetUserId', '==', uid).get();
  console.log(`\nFound ${adminLogs.size} admin actions targeting this user:`);
  adminLogs.forEach(l => {
      const d = l.data();
      console.log(`- [${d.createdAt?.toDate?.()}] Admin ID: ${d.adminId}, Action: ${d.action}, details:`, d.details);
  });
}

check().then(() => process.exit(0)).catch(console.error);
