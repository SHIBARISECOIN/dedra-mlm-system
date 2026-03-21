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
  bonuses.forEach(doc => {
    const b = doc.data();
    if (b.createdAt && b.createdAt.toDate() >= startOfDay) {
      if (b.type.includes('rank')) {
        rankBonusFromOther++;
        console.log(`Rank Bonus: fromUserId=${b.fromUserId}, amount=${b.amountUsdt}, fromLevel=${b.fromLevel}`);
      }
    }
  });
  console.log("Total rank bonus records:", rankBonusFromOther);
}
run();
