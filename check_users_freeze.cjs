const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkUsers() {
  const usernames = ['mm15', 'mm16', 'mm17', 'mm18'];
  
  // 1. Check maintenance mode
  const sysDoc = await db.collection('settings').doc('system').get();
  console.log('--- System Settings ---');
  console.log('maintenanceMode:', sysDoc.data()?.maintenanceMode);
  console.log('-----------------------\n');

  for (const un of usernames) {
    console.log(`Checking user: ${un}`);
    const usersSnap = await db.collection('users').where('username', '==', un).get();
    if (usersSnap.empty) {
      console.log(`  User ${un} not found!`);
      continue;
    }
    
    const userDoc = usersSnap.docs[0];
    const userData = userDoc.data();
    const uid = userDoc.id;
    console.log(`  UID: ${uid}, role: ${userData.role}, status: ${userData.status}`);
    
    const walletDoc = await db.collection('wallets').doc(uid).get();
    const walletData = walletDoc.data() || {};
    console.log(`  usdtBalance: ${walletData.usdtBalance}, dedraBalance: ${walletData.dedraBalance}`);
    console.log('');
  }
}

checkUsers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
