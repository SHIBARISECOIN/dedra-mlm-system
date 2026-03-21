import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  console.log("Total active investments:", invSnap.size);
  let count20 = 0;
  let count19 = 0;
  invSnap.forEach(doc => {
    const inv = doc.data();
    if (inv.lastSettledAt && inv.lastSettledAt.startsWith('2026-03-20')) count20++;
    if (inv.lastSettledAt && inv.lastSettledAt.startsWith('2026-03-19')) count19++;
  });
  console.log(`2026-03-20 count: ${count20}, 2026-03-19 count: ${count19}`);
}
run();
