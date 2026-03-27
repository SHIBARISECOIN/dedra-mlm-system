const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fix() {
  const invSnap = await db.collection('investments').get();
  const usersSnap = await db.collection('users').get();
  const userMap = new Map();
  usersSnap.forEach(u => userMap.set(u.id, u.data()));

  let count = 0;
  for (const doc of invSnap.docs) {
    const inv = doc.data();
    const u = userMap.get(inv.userId);
    const autoCompound = u?.autoCompound || false;

    if (!autoCompound) {
      // If no auto-compound, the principal shouldn't change.
      // Wait, is there a way to know the original principal? 
      // Usually inv.amount / inv.amountUsdt should not be less than expected, but what is expected?
      // Check if there are other fields like 'deposit' or if we can see ROI logs.
      console.log(`User: ${inv.userId}, Inv: ${doc.id}, Amount: ${inv.amountUsdt}`);
    }
  }
}
fix().catch(console.error).finally(() => process.exit(0));
