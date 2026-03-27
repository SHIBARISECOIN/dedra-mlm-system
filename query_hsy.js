import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const q = await db.collection('users').where('id', '==', 'hsy7948').get();
  if (q.empty) {
      console.log('Not found by ID');
  } else {
      q.forEach(doc => console.log('Found by ID:', doc.data()));
  }
  
  // also check abusive logs?
  const logs = await db.collection('audit_logs').where('userId', '==', 'hsy7948').get();
  if (!logs.empty) {
      logs.forEach(doc => console.log('Audit log:', doc.data()));
  }
}

check().then(() => process.exit(0)).catch(console.error);
