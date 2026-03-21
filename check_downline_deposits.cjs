const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const uids = ['IVtjukQWdCaI484zmNeSHKOjq9C2', 'T2ksMhuU59PTD2Su0uRxjZSHmeD2'];
  for (const uid of uids) {
    const snap = await db.collection('transactions')
      .where('userId', '==', uid)
      .where('type', '==', 'deposit')
      .where('status', '==', 'approved')
      .get();
    
    let sum = 0;
    snap.forEach(doc => {
      sum += doc.data().amount || 0;
    });
    console.log(`UID: ${uid}, deposit sum: ${sum}, count: ${snap.size}`);
    
    // Also check other tx types
    const snap2 = await db.collection('transactions').where('userId', '==', uid).get();
    let txTypes = {};
    snap2.forEach(doc => {
      const t = doc.data().type;
      txTypes[t] = (txTypes[t] || 0) + 1;
    });
    console.log(`UID: ${uid}, all tx types:`, txTypes);
  }
}

run().catch(console.error);
