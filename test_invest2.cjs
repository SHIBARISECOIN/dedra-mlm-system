const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function checkUser(uid) {
  const user = await db.collection('users').doc(uid).get();
  console.log('User status:', user.data()?.status);
  
  const wallet = await db.collection('wallets').doc(uid).get();
  console.log('Wallet usdtBalance:', wallet.data()?.usdtBalance);
}

checkUser('FurEKL6mMaNvM4UyqJnDddPvbES2').then(() => process.exit(0));
