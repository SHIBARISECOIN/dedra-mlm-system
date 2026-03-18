const admin = require('firebase-admin');
const fs = require('fs');
const saContent = fs.readFileSync('/home/user/webapp/sa.js', 'utf8').replace('const SERVICE_ACCOUNT = ', '').replace(/};\s*$/, '}');
const SERVICE_ACCOUNT = eval('(' + saContent + ')');
admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
const db = admin.firestore();
async function run() {
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const q = await db.collection('bonuses').where('type', '==', 'daily_roi').where('createdAt', '>', yesterday).get();
  console.log("Daily ROI bonuses today:", q.size);
  if (q.size > 0) {
    const first = q.docs[0].data();
    console.log("Sample:", first.userId, first.amount, first.createdAt?.toDate());
  }
}
run().catch(console.error);
