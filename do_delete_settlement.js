import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  await db.collection('settlements').doc('2026-03-20').delete();
  console.log("Deleted 2026-03-20");
  await db.collection('settlements').doc('2026-03-21').delete();
  console.log("Deleted 2026-03-21");
}
run().catch(console.error).finally(() => process.exit(0));
