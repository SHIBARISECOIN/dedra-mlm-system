const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  console.log("=== Investigating User: hsy7948 ===");
  
  // 1. Get User
  const uSnap = await db.collection('users').where('username', '==', 'hsy7948').get();
  if (uSnap.empty) {
      console.log("User not found!");
      return;
  }
  const user = uSnap.docs[0].data();
  const uid = uSnap.docs[0].id;
  console.log(`\n[User Info]`);
  console.log(`UID: ${uid}`);
  console.log(`Email: ${user.email}`);
  console.log(`Created At: ${user.createdAt ? user.createdAt.toDate() : 'N/A'}`);
  console.log(`Rank: ${user.rank}, Role: ${user.role}, Status: ${user.status}`);
  console.log(`Referred By: ${user.referredBy}`);
  console.log(`Total Invested (record): ${user.totalInvested}`);
  console.log(`Total Revenue (record): ${user.totalRevenue}`);
  
  // 2. Get Wallet
  const wSnap = await db.collection('wallets').doc(uid).get();
  let wallet = {};
  if (wSnap.exists) {
      wallet = wSnap.data();
  } else {
      const wq = await db.collection('wallets').where('userId', '==', uid).get();
      if (!wq.empty) wallet = wq.docs[0].data();
  }
  console.log(`\n[Wallet Info]`);
  console.log(`USDT Balance: ${wallet.usdtBalance || 0}`);
  console.log(`Bonus Balance: ${wallet.bonusBalance || 0}`);
  console.log(`DDRA Balance: ${wallet.dedraBalance || 0}`);
  console.log(`Total Deposit: ${wallet.totalDeposit || 0}`);
  console.log(`Total Withdrawal: ${wallet.totalWithdrawal || 0}`);

  // 3. Get Investments
  const invSnap = await db.collection('investments').where('userId', '==', uid).get();
  console.log(`\n[Investments: ${invSnap.size} total]`);
  invSnap.forEach(d => {
      const inv = d.data();
      const st = inv.startDate ? (inv.startDate.toDate ? inv.startDate.toDate().toISOString() : new Date(inv.startDate).toISOString()) : 'N/A';
      console.log(` - ID: ${d.id} | Amount: ${inv.amount} | Status: ${inv.status} | Date: ${st} | isReinvest: ${!!inv.isReinvest}`);
  });

  // 4. Get Transactions
  const txSnap = await db.collection('transactions').where('userId', '==', uid).orderBy('createdAt', 'desc').get();
  console.log(`\n[Transactions: ${txSnap.size} total (showing latest 20)]`);
  let txCount = 0;
  txSnap.forEach(d => {
      if(txCount++ >= 20) return;
      const tx = d.data();
      let t = 'Unknown';
      if (tx.createdAt && tx.createdAt.toDate) t = tx.createdAt.toDate().toISOString();
      else if (tx.createdAt && tx.createdAt._seconds) t = new Date(tx.createdAt._seconds*1000).toISOString();
      console.log(` - [${t}] Type: ${tx.type} | Amount: ${tx.amountUsdt || tx.amount || 0} | Status: ${tx.status || 'N/A'} | Note: ${tx.reason || tx.adminMemo || tx.memo || ''}`);
  });

}
run().catch(console.error).finally(() => process.exit(0));
