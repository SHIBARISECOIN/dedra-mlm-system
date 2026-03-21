import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const rsDoc = await db.collection('settings').doc('rates').get();
  const rates = rsDoc.data();
  const gapRate = rates.rankGapRatePerStep || 10;
  
  console.log(`Gap Rate per step is ${gapRate}%. G2 gets ${gapRate * 2}%, G3 gets ${gapRate * 3}%.`);
  // So G3 received 30% of ROI as rank bonus instead of 20%?
  // Let's verify the code for rank gap
  
  console.log("Actually, to calculate how much we should take back from Mark:");
  // For every rank_bonus he received, if he was G3 (level 3), he got a gap based on 3.
  // We can just look at each rank_bonus. He received 139.74 USDT. 
  // If he had been G2 instead of G3, how much would he have received?
  // Is it perfectly proportional or dependent on the lower nodes' ranks?
  // Let's fetch one of his rank bonuses.
  const markId = 'qAdGKU772oVGZ0B5PwUEbL3UqSF3';
  const startOfDay = new Date('2026-03-20T00:00:00.000Z');
  
  const bonuses = await db.collection('bonuses')
    .where('userId', '==', markId)
    .where('type', '==', 'rank_bonus')
    .limit(10)
    .get();
    
  bonuses.forEach(doc => {
    console.log(doc.data().amountUsdt, "from level", doc.data().fromLevel, "gap?", doc.data().gapPct);
  });
}
run();
