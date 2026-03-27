const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const usersRef = db.collection('users');
  const snap1 = await usersRef.where('username', '==', 'qwer78451').get();
  const snap2 = await usersRef.where('username', '==', 'qwer78452').get();
  
  const users = [...snap1.docs, ...snap2.docs];
  
  if (users.length === 0) {
    console.log("Users not found by username. Trying email...");
    const snap3 = await usersRef.where('email', '>=', 'qwer78451').where('email', '<=', 'qwer78452\uf8ff').get();
    users.push(...snap3.docs);
  }

  for (const u of users) {
    const data = u.data();
    console.log(`\n--- User: ${data.username || data.email} (${u.id}) ---`);
    console.log(`User doc totalInvested: ${data.totalInvested}`);
    
    const wallet = await db.collection('wallets').doc(u.id).get();
    if (wallet.exists) {
      console.log(`Wallet doc totalInvest: ${wallet.data().totalInvest}`);
    } else {
      console.log(`Wallet not found!`);
    }
    
    const invSnap = await db.collection('investments').where('userId', '==', u.id).get();
    let totalInv = 0;
    let activeInv = 0;
    invSnap.forEach(inv => {
      const invData = inv.data();
      console.log(` - Investment [${invData.status}]: ${invData.amount} USDT (Product: ${invData.productName})`);
      totalInv += (invData.amount || 0);
      if (invData.status === 'active') activeInv += (invData.amount || 0);
    });
    console.log(`Total from investments collection: ${totalInv} (Active: ${activeInv})`);
  }
  
  process.exit(0);
}
run();
