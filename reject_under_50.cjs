const admin = require('firebase-admin');
const fs = require('fs');

const key = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(key)
  });
}
const db = admin.firestore();

async function run() {
  const snap = await db.collection('transactions')
    .where('type', '==', 'withdrawal')
    .where('status', '==', 'pending')
    .get();
    
  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const amt = data.amountUsdt || data.amount; 
    if (amt < 50) {
      console.log(`Rejecting doc ${doc.id} for user ${data.userEmail} amount ${amt}`);
      
      const txRef = db.collection('transactions').doc(doc.id);
      const walletRef = db.collection('wallets').doc(data.userId);
      
      await db.runTransaction(async (t) => {
        const tDoc = await t.get(txRef);
        const wDoc = await t.get(walletRef);
        
        if (tDoc.data().status !== 'pending') return;
        
        t.update(txRef, {
          status: 'rejected',
          rejectReason: '최소 출금액(50 USDT) 미만 시스템 자동 거절',
          rejectedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        if (wDoc.exists) {
          const currentBonus = wDoc.data().bonusBalance || 0;
          t.update(walletRef, {
            bonusBalance: currentBonus + data.amountUsdt
          });
        }
      });
      count++;
    }
  }
  console.log(`Rejected ${count} withdrawals under 50 USDT.`);
}

run().catch(console.error).finally(() => process.exit(0));
