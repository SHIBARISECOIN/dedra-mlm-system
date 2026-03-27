const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function clean() {
  const targetDate = '2026-03-26';
  
  // 1. Fetch bonuses
  const bonusesSnapshot = await db.collection('bonuses').where('settlementDate', '==', targetDate).get();
  console.log(`Found ${bonusesSnapshot.size} bonuses for ${targetDate}`);
  
  // 2. Fetch wallets and investments
  const usersSnap = await db.collection('users').get();
  const wSnap = await db.collection('wallets').get();
  const wMap = new Map();
  wSnap.forEach(d => wMap.set(d.id, d.data()));
  
  const iSnap = await db.collection('investments').get();
  const iMap = new Map();
  iSnap.forEach(d => iMap.set(d.id, d.data()));
  
  const userWalletsDelta = {};
  const invReversals = {};
  
  bonusesSnapshot.forEach(doc => {
    const b = doc.data();
    if (!userWalletsDelta[b.userId]) {
      userWalletsDelta[b.userId] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0 };
    }
    const d = userWalletsDelta[b.userId];
    d.totalEarnings += (b.amountUsdt || 0);

    if (b.type === 'roi') {
      const uDoc = usersSnap.docs.find(x => x.id === b.userId);
      const autoCompound = uDoc ? uDoc.data().autoCompound : false;
      if (autoCompound) {
        d.totalInvest += (b.amountUsdt || 0);
      } else {
        d.bonusBalance += (b.amountUsdt || 0);
      }
      if (b.investmentId) {
        invReversals[b.investmentId] = (invReversals[b.investmentId] || 0) + (b.amountUsdt || 0);
      }
    } else {
      d.bonusBalance += (b.amountUsdt || 0);
    }
  });

  // Batch process
  const batchArray = [];
  let batch = db.batch();
  let count = 0;
  
  function getBatch() {
    if (count >= 490) {
      batchArray.push(batch);
      batch = db.batch();
      count = 0;
    }
    count++;
    return batch;
  }
  
  // Delete bonuses
  bonusesSnapshot.forEach(doc => {
    getBatch().delete(doc.ref);
  });
  
  // Revert Wallets
  for (const [userId, delta] of Object.entries(userWalletsDelta)) {
    const w = wMap.get(userId);
    if (w) {
      const newBonus = Math.max(0, (w.bonusBalance || 0) - delta.bonusBalance);
      const newTotalE = Math.max(0, (w.totalEarnings || 0) - delta.totalEarnings);
      const newTotalI = Math.max(0, (w.totalInvest || w.totalInvested || 0) - delta.totalInvest);
      getBatch().update(db.collection('wallets').doc(userId), {
        bonusBalance: newBonus,
        totalEarnings: newTotalE,
        totalInvest: newTotalI
      });
    }
  }
  
  // Revert Investments
  for (const [invId, amt] of Object.entries(invReversals)) {
    const inv = iMap.get(invId);
    if (inv) {
      const newAmount = Math.max(0, (inv.amountUsdt || 0) - amt);
      const dailyPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
      const expected = newAmount * (dailyPct / 100);
      getBatch().update(db.collection('investments').doc(invId), {
        amount: newAmount,
        amountUsdt: newAmount,
        expectedReturn: expected,
        paidRoi: Math.max(0, (inv.paidRoi || 0) - amt),
        lastSettledAt: '2026-03-25T23:59:59.000Z'
      });
    }
  }
  
  // Delete settlement
  getBatch().delete(db.collection('settlements').doc(targetDate));
  
  if (count > 0) batchArray.push(batch);
  
  console.log(`Executing ${batchArray.length} batches...`);
  for (const b of batchArray) {
    await b.commit();
  }
  console.log("Cleanup complete!");
}

clean().catch(console.error).finally(() => process.exit(0));
