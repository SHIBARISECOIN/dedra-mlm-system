const admin = require('firebase-admin');
const sa = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function checkUser() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('id', '==', 'moodo9569').get();
  
  const userDoc = snapshot.empty ? (await usersRef.where('username', '==', 'moodo9569').get()).docs[0] : snapshot.docs[0];
  if (!userDoc) {
    console.log('User not found.');
    return;
  }
  const user = userDoc.data();
  console.log('=== User Data ===');
  console.log(`Email: ${user.email}`);
  console.log(`balance_USDT: ${user.balance_USDT}`);
  console.log(`balance_DDRA: ${user.balance_DDRA}`);
  console.log(`Total Invested: ${user.totalInvested}`);
  
  // Try to print everything that looks like a balance
  for (let k in user) {
    if (k.toLowerCase().includes('usdt') || k.toLowerCase().includes('ddra') || k.toLowerCase().includes('balance') || k.toLowerCase().includes('bonus')) {
      console.log(`${k}: ${user[k]}`);
    }
  }
  
  console.log('\n=== Recent Transactions ===');
  const txRef = db.collection('transactions');
  const txSnapshot = await txRef.where('userId', '==', userDoc.id).get();
  
  let txs = [];
  txSnapshot.forEach(doc => {
    let tx = doc.data();
    tx.id = doc.id;
    txs.push(tx);
  });
  
  txs.sort((a, b) => {
    let tA = a.createdAt ? a.createdAt.toDate().getTime() : 0;
    let tB = b.createdAt ? b.createdAt.toDate().getTime() : 0;
    return tB - tA;
  });
  
  if (txs.length === 0) {
    console.log('No transactions found.');
  } else {
    txs.slice(0, 30).forEach(tx => {
      const date = tx.createdAt ? tx.createdAt.toDate().toISOString() : 'N/A';
      console.log(`[${date}] ID: ${tx.id} | Type: ${tx.type}, Amount: ${tx.amount}, Status: ${tx.status}, Note: ${tx.note || ''}`);
    });
  }
  
  process.exit(0);
}
checkUser().catch(console.error);
