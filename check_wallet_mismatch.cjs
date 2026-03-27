const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const usersSnap = await db.collection('users').get();
  const walletsSnap = await db.collection('wallets').get();
  
  const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const walletMap = {};
  walletsSnap.docs.forEach(d => {
    walletMap[d.id] = d.data();
  });
  
  let count = 0;
  for (const u of allUsers) {
    const uInvest = parseFloat(u.totalInvested || 0);
    const w = walletMap[u.id] || {};
    const wInvest = parseFloat(w.totalInvested || w.totalInvest || 0);
    
    if (Math.abs(uInvest - wInvest) > 0.1) {
      console.log(`${u.email || u.id} -> User: ${uInvest}, Wallet: ${wInvest}`);
      count++;
    }
  }
  console.log(`Total mismatched: ${count}`);
}
check().catch(console.error);
