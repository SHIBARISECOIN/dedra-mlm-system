import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./sa.js', 'utf8').replace('export default ', '').replace(';', ''));

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
