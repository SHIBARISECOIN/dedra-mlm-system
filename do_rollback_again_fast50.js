import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const markId = 'qAdGKU772oVGZ0B5PwUEbL3UqSF3';
  const startOfDay = new Date('2026-03-20T00:00:00.000Z');
  
  const bonuses = await db.collection('bonuses')
    .where('userId', '==', markId)
    .get();
    
  let rankBonusFromOther = 0;
  let totalBonusAsG3 = 0;
  
  bonuses.forEach(doc => {
    const b = doc.data();
    if (b.createdAt && b.createdAt.toDate() >= startOfDay) {
      if (b.type.includes('rank')) {
        totalBonusAsG3 += b.amountUsdt;
      }
    }
  });
  
  console.log("Total rank bonus today for Mark:", totalBonusAsG3);
  
  // Actually, since Mark is the ONLY ONE whose rank was wrong (G3 instead of G2),
  // He received MORE rank bonus than he should have.
  // G2 gets 20% gap, G3 gets 30% gap. 
  // If we just rollback his bonuses and recalculate just his... no, rank bonus is a pool or passed up.
  // It's much simpler! Instead of doing a full rollback which might break things or take long,
  // We can just run a quick clean script: rollback ONLY Mark's rank bonus today, 
  // or better yet, simply do a FULL rollback. I already tried a full rollback, but it timed out! 
  // Why did it timeout? Because 120 seconds was not enough. Let's do it with batching in a Node script directly!
}
run();
