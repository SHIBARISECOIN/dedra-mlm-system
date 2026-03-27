const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function doRollback() {
  const targetDate = '2026-03-26';
  console.log(`Starting local rollback for ${targetDate}`);
  
  const bonusesSnapshot = await db.collection('bonuses')
    .where('settlementDate', '==', targetDate)
    .get();
    
  console.log(`Found ${bonusesSnapshot.size} bonuses.`);
  
  // To avoid complex partial math that might be wrong from duplicate bonuses,
  // let's do an exact replay logic or just recalculate wallets from scratch?
  // Recalculating all wallets from scratch is safest!
  
  console.log("Recalculating all wallets from scratch (excluding 26th)...");
  
  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  usersSnap.forEach(d => userMap.set(d.id, d.data()));
  
  const invSnap = await db.collection('investments').get();
  const invMap = new Map();
  invSnap.forEach(d => invMap.set(d.id, d.data()));
  
  const allBonuses = await db.collection('bonuses').get();
  const validBonuses = [];
  const deletedBonusIds = [];
  
  allBonuses.forEach(d => {
    if (d.data().settlementDate === targetDate) {
      deletedBonusIds.push(d.id);
    } else {
      validBonuses.push(d.data());
    }
  });
  
  console.log(`Will delete ${deletedBonusIds.length} bonuses for ${targetDate}.`);
  
  // Rebuild user wallets
  const newWallets = {};
  usersSnap.forEach(doc => {
    newWallets[doc.id] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0 };
  });
  
  // Sum up valid bonuses
  validBonuses.forEach(b => {
    const uid = b.userId;
    if (!newWallets[uid]) newWallets[uid] = { bonusBalance: 0, totalEarnings: 0, totalInvest: 0 };
    
    newWallets[uid].totalEarnings += (b.amountUsdt || 0);
    
    if (b.type === 'roi') {
      const u = userMap.get(uid);
      if (u && u.autoCompound) {
        newWallets[uid].totalInvest += (b.amountUsdt || 0);
      } else {
        newWallets[uid].bonusBalance += (b.amountUsdt || 0);
      }
    } else {
      newWallets[uid].bonusBalance += (b.amountUsdt || 0);
    }
  });
  
  // Subtract withdrawals from bonusBalance
  const wSnap = await db.collection('withdrawals').get();
  wSnap.forEach(d => {
    const w = d.data();
    if (w.status === 'completed') { // adjust if 'approved' or 'completed'
      const uid = w.userId;
      if (newWallets[uid]) {
        newWallets[uid].bonusBalance -= (w.amountUsdt || w.amount || 0);
      }
    }
  });
  
  // We won't reconstruct totalInvest from investments because investments can be complex.
  // Wait, totalInvest is usually base investments + autoCompound.
  // Instead of full rebuild, maybe just run the rollback math but only ONCE?
  // Because we have duplicates, if we subtract duplicate amounts, wallet balance will go NEGATIVE!
  // Let's check if there are negative balances!
}

doRollback().catch(console.error).finally(() => process.exit(0));
