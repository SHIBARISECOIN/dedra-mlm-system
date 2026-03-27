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
    
    // Get withdrawals without ordering to avoid index error
    const txSnap = await db.collection('transactions')
      .where('userId', '==', uid)
      .where('type', '==', 'withdrawal')
      .get();
      
    if (txSnap.empty) {
      console.log(`No withdrawal transactions found for ${un}.`);
    } else {
      // sort manually
      const docs = txSnap.docs.map(d => ({id: d.id, ...d.data()}));
      docs.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      
      docs.slice(0, 5).forEach(data => {
        const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toISOString() : 'Unknown date';
        console.log(`TxID: ${data.id}`);
        console.log(`  Date: ${date}`);
        console.log(`  Amount: ${data.amount} ${data.currency} (USDT: ${data.amountUsdt || 'N/A'})`);
        console.log(`  Status: ${data.status}`);
        console.log(`  To Address: ${data.toAddress}`);
        if (data.memo) console.log(`  Memo: ${data.memo}`);
        if (data.error) console.log(`  Error: ${data.error}`);
        if (data.txHash) console.log(`  txHash: ${data.txHash}`);
      });
    }
  }
}

checkWithdrawals().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
