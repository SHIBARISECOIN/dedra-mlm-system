const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fix() {
  const iSnap = await db.collection('investments').where('lastSettledAt', '>=', '2026-03-26').get();
  console.log(`Found ${iSnap.size} investments stuck on 26th.`);
  
  const usersSnap = await db.collection('users').get();
  const uMap = new Map();
  usersSnap.forEach(d => uMap.set(d.id, d.data()));
  
  let batch = db.batch();
  let count = 0;
  const batchArray = [];
  
  function getBatch() {
    if (count >= 490) {
      batchArray.push(batch);
      batch = db.batch();
      count = 0;
    }
    count++;
    return batch;
  }
  
  iSnap.forEach(doc => {
    const inv = doc.data();
    // We need to revert exactly 1 day of ROI.
    const dailyPct = inv.dailyRoi || inv.roiPercent || inv.roiPct || 0;
    
    // But wait, if they have autoCompound = true, their amount was increased by 1 day's earnings.
    // However, they compounded ON the 26th. What was the base amount?
    // amount_new = amount_old + amount_old * dailyPct.
    // amount_old = amount_new / (1 + dailyPct).
    const u = uMap.get(inv.userId);
    let newAmount = inv.amountUsdt || 0;
    let oldPaidRoi = inv.paidRoi || 0;
    
    if (u && u.autoCompound) {
      // Revert compounding
      newAmount = newAmount / (1 + (dailyPct / 100));
      newAmount = Math.round(newAmount * 1e8) / 1e8; // fix floating point
    } else {
      // Revert paidRoi
      const dailyEarning = newAmount * (dailyPct / 100);
      oldPaidRoi = Math.max(0, oldPaidRoi - dailyEarning);
    }
    
    const expected = newAmount * (dailyPct / 100);
    
    getBatch().update(doc.ref, {
      amount: newAmount,
      amountUsdt: newAmount,
      expectedReturn: expected,
      paidRoi: oldPaidRoi,
      lastSettledAt: '2026-03-25T23:59:59.000Z'
    });
  });
  
  if (count > 0) batchArray.push(batch);
  console.log(`Committing ${batchArray.length} batches...`);
  for (const b of batchArray) {
    await b.commit();
  }
  console.log("Investments fixed.");
}

fix().catch(console.error).finally(() => process.exit(0));
