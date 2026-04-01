const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  try {
    console.log("=== User Search: cyj0300 ===");
    const usersSnap = await db.collection('users').where('email', '>=', 'cyj0300').where('email', '<=', 'cyj0300\uf8ff').get();
    let user = null;
    if (usersSnap.empty) {
      console.log("User not found by email, trying by name...");
      const nameSnap = await db.collection('users').where('name', '==', '신영재').get();
      if (!nameSnap.empty) {
        user = nameSnap.docs[0];
      }
    } else {
      user = usersSnap.docs[0];
    }

    if (!user) {
      console.log("Could not find user.");
      return;
    }

    const userData = user.data();
    console.log(`Found User: ID=${user.id}, Name=${userData.name}, Email=${userData.email}`);

    const walletSnap = await db.collection('wallets').doc(user.id).get();
    if (walletSnap.exists) {
      const w = walletSnap.data();
      console.log(`Wallet: USDT=${w.usdtBalance}, TotalDeposit=${w.totalDeposit}, TotalEarnings=${w.totalEarnings}`);
    }

    console.log("\n=== Recent Deposits ===");
    const txSnap = await db.collection('transactions')
      .where('userId', '==', user.id)
      .where('type', '==', 'deposit')
      .orderBy('createdAt', 'desc').limit(5).get();
    txSnap.forEach(d => {
      const t = d.data();
      console.log(`Deposit: Date=${t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt}, Amount=${t.amount}, Status=${t.status}`);
    });

    console.log("\n=== ROI for last 3 days ===");
    const roiSnap = await db.collection('bonuses')
      .where('userId', '==', user.id)
      .where('type', '==', 'roi')
      .orderBy('createdAt', 'desc').limit(10).get();
    roiSnap.forEach(d => {
      const b = d.data();
      console.log(`ROI: Date=${b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : b.createdAt}, Amount=${b.amount}`);
    });

    console.log("\n=== Rank Bonuses for last 3 days ===");
    const rankSnap = await db.collection('bonuses')
      .where('userId', '==', user.id)
      .where('type', 'in', ['rank_bonus', 'rank_rollup', 'rank_matching'])
      .orderBy('createdAt', 'desc').get();
    
    let count0331 = 0;
    let count0401 = 0;
    let rankTypes = {};

    rankSnap.forEach(d => {
      const b = d.data();
      const dateStr = b.createdAt?.toDate ? b.createdAt.toDate().toISOString() : String(b.createdAt);
      if (dateStr.includes('2026-03-31')) count0331++;
      if (dateStr.includes('2026-04-01')) count0401++;
      
      if (!rankTypes[dateStr.split('T')[0]]) rankTypes[dateStr.split('T')[0]] = 0;
      rankTypes[dateStr.split('T')[0]]++;
    });

    console.log(`Rank Bonus Count (All Types):`);
    console.log(`- 2026-03-31: ${count0331}`);
    console.log(`- 2026-04-01: ${count0401}`);
    console.log("Daily breakdown:", rankTypes);

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
