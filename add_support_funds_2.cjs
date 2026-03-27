const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function addFunds() {
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

    const batch = db.batch();
    
    // Add to usdtBalance only (can be used for FREEZE, cannot be withdrawn)
    batch.update(db.collection('wallets').doc(uid), {
      usdtBalance: admin.firestore.FieldValue.increment(u.amount)
    });
    
    // Add manual adjust transaction record
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
}

addFunds().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
