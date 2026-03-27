const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const invsSnap = await db.collection('investments').get();
  
  console.log(`Checking ${invsSnap.size} investments for amount changes...`);
  
  let decreasedInvs = [];
  
  for (const doc of invsSnap.docs) {
    const inv = doc.data();
    // if amount is significantly different from total amount
    if (inv.amountUsdt !== undefined && inv.amountUsdt < 935 && inv.amountUsdt > 900) {
      decreasedInvs.push({ id: doc.id, ...inv });
    }
  }
  
  console.log(`Found ${decreasedInvs.length} investments that match the ~930.2615 pattern.`);
  if (decreasedInvs.length > 0) {
    console.log("Sample:", decreasedInvs[0]);
  }
}

run().catch(console.error).finally(() => process.exit(0));
