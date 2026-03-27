const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const users = [
    { username: 'pks2237', amount: 100 },
    { username: 'cws3410', amount: 100 }
  ];

  for (const u of users) {
    const usersSnap = await db.collection('users').where('username', '==', u.username).get();
    if (usersSnap.empty) {
      console.log(`User ${u.username} not found!`);
      continue;
    }
    const uid = usersSnap.docs[0].id;
    const userEmail = usersSnap.docs[0].data().email;

    // Check if recently funded to avoid double-funding due to previous timeout
    const recentTx = await db.collection('transactions')
      .where('userId', '==', uid)
      .where('type', '==', 'manual_adjust')
      .where('amount', '==', u.amount)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    let shouldAdd = true;
    if (!recentTx.empty) {
      const txTime = recentTx.docs[0].data().createdAt.toDate();
      const now = new Date();
      // If funded within the last 10 minutes, skip
      if (now - txTime < 10 * 60 * 1000) {
        console.log(`User ${u.username} already received funding recently. Skipping to prevent double funding.`);
        shouldAdd = false;
      }
    }

    if (shouldAdd) {
      const batch = db.batch();
      
      batch.update(db.collection('wallets').doc(uid), {
        usdtBalance: admin.firestore.FieldValue.increment(u.amount)
      });
      
      const txRef = db.collection('transactions').doc();
      batch.set(txRef, {
        type: 'manual_adjust',
        userId: uid,
        userEmail: userEmail,
        amount: u.amount,
        walletType: 'usdtBalance',
        reason: '관리자 특별 지원금 (출금 불가)',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        adminId: 'system'
      });

      await batch.commit();
      console.log(`Successfully added ${u.amount} USDT to ${u.username} (UID: ${uid}).`);
    }
    
    // Verify wallet
    const wDoc = await db.collection('wallets').doc(uid).get();
    console.log(`  Current USDT Balance for ${u.username}: ${wDoc.data().usdtBalance}`);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
