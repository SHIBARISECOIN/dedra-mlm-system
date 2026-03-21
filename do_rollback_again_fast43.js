import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const settingsDoc = await db.collection('settings').doc('rankPromotion').get();
  const settings = settingsDoc.data();
  console.log("Rank Rates:");
  console.log(settings.rates);
}
run();
