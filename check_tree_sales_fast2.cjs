const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const users = ['ssm9310', 'kcy9313', 'pdh8949', 'csr5543'];
  for (const un of users) {
    const q1 = await db.collection('users').where('username', '==', un).get();
    if (q1.empty) continue;
    const user = q1.docs[0];
    const data = user.data();
    console.log(`User: ${un}`);
    console.log(`  본인 매출 (totalInvested): ${data.totalInvested}`);
    console.log(`  산하 합계 (networkSales): ${data.networkSales}`);
    console.log(`  총 합계 (totalSales): ${data.totalSales}`);
    
    const children = await db.collection('users').where('sponsorId', '==', user.id).get();
    let cSum = 0;
    children.forEach(c => cSum += (c.data().totalInvested || 0));
    console.log(`  직대 매출 합계 (totalInvested of children): ${cSum}`);
    console.log('---');
  }
}
run().then(() => process.exit(0)).catch(console.error);
