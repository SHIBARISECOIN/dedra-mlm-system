import admin from 'firebase-admin';
import serviceAccount from './sa.js';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const doc = await db.collection('settings').doc('system').get();
  console.log("System Settings:", doc.data());
}
check();
