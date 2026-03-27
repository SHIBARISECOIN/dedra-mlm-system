const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function checkWithdrawals() {
  const usernames = ['hsh17699', 'hsh176991'];
  
  for (const un of usernames) {
    console.log(`\n--- Checking user: ${un} ---`);
    const usersSnap = await db.collection('users').where('username', '==', un).get();
    
    if (usersSnap.empty) {
      console.log(`User ${un} not found.`);
      continue;
    }
    
    const uid = usersSnap.docs[0].id;
    console.log(`UID: ${uid}`);
    
    // Check wallet balance just in case
    const walletDoc = await db.collection('wallets').doc(uid).get();
    console.log(`Wallet - USDT: ${walletDoc.data()?.usdtBalance || 0}, Bonus: ${walletDoc.data()?.bonusBalance || 0}`);
    
    // Get withdrawals
    const txSnap = await db.collection('transactions')
      .where('userId', '==', uid)
      .where('type', '==', 'withdrawal')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
      
    if (txSnap.empty) {
      console.log(`No withdrawal transactions found for ${un}.`);
    } else {
      txSnap.docs.forEach(doc => {
        const data = doc.data();
        const date = data.createdAt ? data.createdAt.toDate().toISOString() : 'Unknown date';
        console.log(`TxID: ${doc.id}`);
        console.log(`  Date: ${date}`);
        console.log(`  Amount: ${data.amount} ${data.currency} (USDT: ${data.amountUsdt || 'N/A'})`);
        console.log(`  Status: ${data.status}`);
        console.log(`  To Address: ${data.toAddress}`);
        if (data.memo) console.log(`  Memo: ${data.memo}`);
        if (data.error) console.log(`  Error: ${data.error}`);
      });
    }
  }
}

checkWithdrawals().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
