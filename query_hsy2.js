import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function check() {
  const usersRef = db.collection('users');
  const snap = await usersRef.get();
  snap.forEach(doc => {
      const data = doc.data();
      const id = (data.id || '').toLowerCase();
      const email = (data.email || '').toLowerCase();
      const nickname = (data.nickname || '').toLowerCase();
      const name = (data.name || '').toLowerCase();
      
      if (id.includes('hsy7948') || email.includes('hsy7948') || nickname.includes('hsy7948') || name.includes('hsy7948') || doc.id.includes('hsy7948')) {
          console.log('Found match:', doc.id, data.id, data.email, data.status);
      }
  });
}

check().then(() => process.exit(0)).catch(console.error);
