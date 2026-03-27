import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function unblock() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02'; // hsy7948
  
  // 1. Un-Suspend User
  await db.collection('users').doc(uid).update({
      status: 'active',
      suspendReason: null
  });
  console.log("User status restored to 'active'.");
}

unblock().then(() => process.exit(0)).catch(console.error);
