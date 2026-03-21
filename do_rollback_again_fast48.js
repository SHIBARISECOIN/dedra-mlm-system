import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const rsDoc = await db.collection('settings').doc('rates').get();
  const rates = rsDoc.data();
  console.log("Ah, the rank gap bonus uses 'rankGapRatePerStep':", rates.rankGapRatePerStep);
  // Mark received Rank Rollup or Matching? Let's check his bonus types
  const markId = 'qAdGKU772oVGZ0B5PwUEbL3UqSF3';
  const startOfDay = new Date('2026-03-20T00:00:00.000Z');
  
  const bonuses = await db.collection('bonuses')
    .where('userId', '==', markId)
    .get();
    
  let totalBonusAsG3 = 0;
  let totalBonusAsG2 = 0;
  let types = {};
  
  bonuses.forEach(doc => {
    const b = doc.data();
    if (b.createdAt && b.createdAt.toDate() >= startOfDay) {
      types[b.type] = (types[b.type] || 0) + b.amountUsdt;
    }
  });
  console.log("Mark's total bonuses today by type:", types);
}
run();
