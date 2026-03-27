import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const saStr = readFileSync('./sa.js', 'utf8').replace('const serviceAccount = ', '').replace(';', '').replace('export default serviceAccount', '').trim();
const serviceAccount = JSON.parse(saStr);

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
