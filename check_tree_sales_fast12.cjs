const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const users = ['ssm9310', 'pdh8949', 'kcy9313', 'csr5543'];
  for (const un of users) {
    const q1 = await db.collection('users').where('username', '==', un).get();
    if (q1.empty) continue;
    const user = q1.docs[0];
    
    console.log(`User: ${un}`);
    console.log(`  => 본인 매출 (invested): ${user.data().totalInvested}`);
    console.log(`  => 산하 전체 합계 (networkSales): ${user.data().networkSales}`);
    console.log(`  => (표시용 전체 합계 = 본인 매출 + 산하 전체 합계 = ${(user.data().totalInvested || 0) + (user.data().networkSales || 0)})`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
