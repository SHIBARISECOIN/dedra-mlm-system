const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const q1 = await db.collection('users').where('username', '==', 'ssm9310').get();
  const parent = q1.docs[0];
  const refCode = parent.data().referralCode;
  
  console.log(`ssm9310 referralCode: ${refCode}`);
  
  const children = await db.collection('users').where('referredBy', '==', refCode).get();
  console.log(`Has ${children.size} direct children by referredBy`);
  
  for (const c of children.docs) {
    const d = c.data();
    console.log(`- ${d.username} (invested: ${d.totalInvested || 0}, networkSales: ${d.networkSales || 0})`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
