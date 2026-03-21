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
    
  let totalBonusToday = 0;
  let g2Count = 0;
  let g3Count = 0;
  bonuses.forEach(doc => {
    const b = doc.data();
    if (b.createdAt && b.createdAt.toDate() >= startOfDay) {
      if (b.type.includes('rank')) {
        totalBonusToday += b.amountUsdt;
        if (b.rank === 'G2' || b.userRank === 'G2') g2Count++;
        if (b.rank === 'G3' || b.userRank === 'G3') g3Count++;
      }
    }
  });
  console.log("Total rank bonus today for mark:", totalBonusToday);
  console.log("G2 received count:", g2Count);
  console.log("G3 received count:", g3Count);
}
run();
