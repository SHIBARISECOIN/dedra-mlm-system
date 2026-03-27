const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const users = ['ssm9310'];
  for (const un of users) {
    const q1 = await db.collection('users').where('username', '==', un).get();
    if (q1.empty) continue;
    const user = q1.docs[0];
    const data = user.data();
    
    // UI Code calculation test
    const networkSales = data.networkSales || 0;
    const totalSales = data.totalSales || 0; // UI uses: n.networkSales || n.totalSales || 0
    const displayedNetworkSales = networkSales || totalSales || 0;
    
    console.log(`For ${un}:`);
    console.log(`DB networkSales: ${data.networkSales}`);
    console.log(`UI will show '전체 합계' as: ${displayedNetworkSales} USDT`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
