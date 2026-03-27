const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  // Just resetting the weird wallet balances from the previous refund if it was bogus
  // The user only has 13 USDT total bonus history. The 800 USDT was likely an exploit or admin test.
  // totalEarnings record is 0.239, let's just reset bonusBalance to totalEarnings and totalWithdrawal to 0 to be safe.
  
  const wRef = db.collection('wallets').doc(uid);
  const wSnap = await wRef.get();
  const d = wSnap.data();
  console.log("Current wallet:", d);
  
  if (d.totalWithdrawal < 0) {
      await wRef.update({
          bonusBalance: d.totalEarnings || 0,
          totalWithdrawal: 0
      });
      console.log("Wallet fixed.");
  } else {
      console.log("No need to fix.");
  }
}
run().catch(console.error).finally(() => process.exit(0));
