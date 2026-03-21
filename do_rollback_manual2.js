import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const d21 = await db.collection('settlements').doc('2026-03-21').get();
  console.log("Settlement 21:", d21.exists, d21.exists ? d21.data().details : '');
}
run();
