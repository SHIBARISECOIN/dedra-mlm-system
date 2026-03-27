const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  // Actually, wait, when they requested withdrawal initially, it did `totalWithdrawal: increment(amountUsdt)` and `bonusBalance: increment(-amountUsdt)`.
  // Wait, if their bonusBalance WAS 0.23, and they requested 800 withdrawal, the client code checks if they have enough balance. 
  // BUT what if the old client code before the security rules update allowed it without balance check? Or what if someone gave them 800, they withdrew, and then someone deleted the admin_adjust record? Let's check admin_adjust.
  
  const adminAdjSnap = await db.collection('transactions').where('type', '==', 'admin_adjust').get();
  adminAdjSnap.forEach(d => {
      const tx = d.data();
      if(tx.userId === uid || tx.userEmail === 'hsy7948@deedra.com') {
          console.log("Admin Adjust for user:", d.id, tx);
      }
  });

  const wdUserSnap = await db.collection('users').doc(uid).get();
  console.log("\nUser Document:", wdUserSnap.data());

}
run().catch(console.error).finally(() => process.exit(0));
