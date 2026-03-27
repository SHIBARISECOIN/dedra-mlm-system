const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  // Check bonuses involving this user
  const bonusSnap = await db.collection('bonuses').where('userId', '==', uid).get();
  console.log(`\n[Bonuses for user: ${bonusSnap.size} found]`);
  let totalBonus = 0;
  bonusSnap.forEach(d => {
      const b = d.data();
      totalBonus += (b.amountUsdt || 0);
      let t = 'Unknown';
      if (b.createdAt && b.createdAt.toDate) t = b.createdAt.toDate().toISOString();
      else if (b.createdAt && b.createdAt._seconds) t = new Date(b.createdAt._seconds*1000).toISOString();
      console.log(` - [${t}] Type: ${b.type} | Amount: ${b.amountUsdt} | FromUser: ${b.fromUserId} | Desc: ${b.description}`);
  });
  console.log("Total Bonus Amount:", totalBonus);
}
run().catch(console.error).finally(() => process.exit(0));
