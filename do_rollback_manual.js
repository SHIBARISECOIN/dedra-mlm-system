import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const targetDate = '2026-03-21';
  console.log(`Starting clean rollback for ${targetDate}`);
  
  // Actually, the API route does this fast, but it timed out in curl.
  // We can just run it using the exact logic.
  const startOfDay = new Date(`2026-03-20T19:07:00.000Z`); // the settlement ran at 19:07 UTC
  const endOfDay = new Date(`2026-03-20T23:59:59.999Z`);
  
  const bonusesSnap = await db.collection('bonuses')
    .where('createdAt', '>=', startOfDay)
    .where('createdAt', '<=', endOfDay)
    .get();
    
  console.log(`Found ${bonusesSnap.size} bonuses to rollback.`);
  
  const userWalletsDelta = {};
  const invReversals = {};
  const bonusesToDelete = [];
  
  bonusesSnap.forEach(doc => {
    const b = doc.data();
    bonusesToDelete.push(doc.id);
    
    if (!userWalletsDelta[b.userId]) {
      userWalletsDelta[b.userId] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0 };
    }
    const d = userWalletsDelta[b.userId];
    d.totalEarnings += b.amountUsdt;
    
    if (b.type === 'roi') {
      if (b.investmentId) {
        invReversals[b.investmentId] = (invReversals[b.investmentId] || 0) + b.amountUsdt;
      }
    } else {
      d.bonusBalance += b.amountUsdt;
    }
  });
  
  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  usersSnap.forEach(doc => userMap.set(doc.id, doc.data()));
  
  bonusesSnap.forEach(doc => {
    const b = doc.data();
    if (b.type === 'roi') {
      const u = userMap.get(b.userId);
      const d = userWalletsDelta[b.userId];
      if (u && u.autoCompound) {
        d.totalInvest += b.amountUsdt;
      } else {
        d.bonusBalance += b.amountUsdt;
      }
    }
  });
  
  let invRevertedCount = 0;
  const invPromises = [];
  for (const [invId, amountToSub] of Object.entries(invReversals)) {
    const invRef = db.collection('investments').doc(invId);
    invPromises.push(invRef.get().then(doc => {
      if (!doc.exists) return null;
      const inv = doc.data();
      const u = userMap.get(inv.userId);
      
      let newAmount = inv.amountUsdt || 0;
      let newExpectedReturn = inv.expectedReturn || 0;
      
      if (u && u.autoCompound) {
        newAmount = Math.max(0, newAmount - amountToSub);
        const dailyRoiPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
        newExpectedReturn = newAmount * (dailyRoiPct / 100);
      }
      
      return invRef.update({
        amount: newAmount,
        amountUsdt: newAmount,
        expectedReturn: newExpectedReturn,
        paidRoi: Math.max(0, (inv.paidRoi || 0) - amountToSub),
        lastSettledAt: "2026-03-20T19:00:00.000Z"
      });
    }));
  }
  for (let i = 0; i < invPromises.length; i += 20) await Promise.all(invPromises.slice(i, i + 20));
  
  const walletPromises = [];
  for (const [userId, delta] of Object.entries(userWalletsDelta)) {
    const wRef = db.collection('wallets').doc(userId);
    walletPromises.push(wRef.get().then(doc => {
      if (!doc.exists) return null;
      const w = doc.data();
      return wRef.update({
        bonusBalance: Math.max(0, (w.bonusBalance || 0) - delta.bonusBalance),
        totalEarnings: Math.max(0, (w.totalEarnings || 0) - delta.totalEarnings),
        totalInvest: Math.max(0, (w.totalInvest || 0) - delta.totalInvest),
        totalInvested: Math.max(0, (w.totalInvested || 0) - delta.totalInvest)
      });
    }));
  }
  for (let i = 0; i < walletPromises.length; i += 20) await Promise.all(walletPromises.slice(i, i + 20));
  
  const bonusPromises = bonusesToDelete.map(id => db.collection('bonuses').doc(id).delete());
  for (let i = 0; i < bonusPromises.length; i += 200) await Promise.all(bonusPromises.slice(i, i + 200));
  
  const settlements = await db.collection('settlements').where('date', '==', targetDate).get();
  for (const doc of settlements.docs) await doc.ref.delete();
  
  console.log("Rollback completed.");
}

run();
