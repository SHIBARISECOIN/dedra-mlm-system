const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function resetAndRun() {
  const targetDate = '2026-03-26';
  console.log(`Starting hard reset for ${targetDate}`);
  
  // 1. Get all bonuses for target date
  const bonusesSnapshot = await db.collection('bonuses')
    .where('settlementDate', '==', targetDate)
    .get();
    
  console.log(`Found ${bonusesSnapshot.size} bonuses to delete.`);
  
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
      // we don't know autoCompound easily here, but let's fetch user
      // Actually we need to fetch all users to know autoCompound
    } else {
      d.bonusBalance += (b.amountUsdt || 0);
    }
  });
  
  // To be perfectly accurate, we should rebuild wallets from scratch, but it's risky.
  // Instead, let's just use the HTTP API rollback which does it properly.
  // But since the API times out, we will do it here.
}

resetAndRun().catch(console.error).finally(() => process.exit(0));
