const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  // The user has a huge bonus balance. Where did it come from? 
  // Maybe "totalWithdrawal": -800 shows something?
  // Our previous script rejected his 800 USDT withdrawal, doing `bonusBalance += 800` and `totalWithdrawal -= 800`.
  // Wait, if bonusBalance is currently 800.23, and we just added 800, before that it was 0.23!
  
  const wSnap = await db.collection('wallets').doc(uid).get();
  console.log("Current Wallet:", wSnap.data());
}
run().catch(console.error).finally(() => process.exit(0));
