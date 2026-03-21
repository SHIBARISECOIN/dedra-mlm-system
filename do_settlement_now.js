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
  console.log("Checking investments...");
  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  const dates = {};
  invSnap.forEach(doc => {
    const data = doc.data();
    let dateStr = 'none';
    if (data.lastSettledAt) {
      if (typeof data.lastSettledAt.toDate === 'function') {
        dateStr = data.lastSettledAt.toDate().toISOString().split('T')[0];
      } else if (typeof data.lastSettledAt === 'string') {
        dateStr = data.lastSettledAt.split('T')[0];
      }
    }
    dates[dateStr] = (dates[dateStr] || 0) + 1;
  });
  console.log("Investment lastSettledAt dates:", dates);
  
  console.log("Checking settlements...");
  const s20 = await db.collection('settlements').doc('2026-03-20').get();
  console.log("2026-03-20 exists:", s20.exists, s20.exists ? s20.data() : "");
  const s21 = await db.collection('settlements').doc('2026-03-21').get();
  console.log("2026-03-21 exists:", s21.exists, s21.exists ? s21.data() : "");
}
run().catch(console.error).finally(() => process.exit(0));
