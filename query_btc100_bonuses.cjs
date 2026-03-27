const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const uid = 'GnfPCaAcRrMGRyfJrN7JlfRFUaw1'; // btc100
  const user = await db.collection('users').doc(uid).get();
  console.log("User:", user.data().email, user.data().level, user.data().rank);
  
  const bonuses = await db.collection('bonuses')
    .where('userId', '==', uid)
    .where('settlementDate', '==', '2026-03-26')
    .get();
    
  console.log("Bonuses for 2026-03-26:", bonuses.size);
  let total = 0;
  bonuses.forEach(b => {
    const d = b.data();
    console.log(`- [${d.type}] ${d.reason || d.level || ''}: ${d.amountUsdt}`);
    total += d.amountUsdt || 0;
  });
  console.log("Total:", total);
  
  const w = await db.collection('wallets').doc(uid).get();
  console.log("Wallet:", w.data());
}

check().catch(console.error).finally(() => process.exit(0));
