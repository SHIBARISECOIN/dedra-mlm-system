const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const user = await db.collection('users').where('username', '==', 'pdh8949').get();
  const uid = user.docs[0].id;
  const children = await db.collection('users').where('sponsorId', '==', uid).get();
  
  console.log(`pdh8949's children:`);
  for (const c of children.docs) {
    const d = c.data();
    console.log(`- ${d.username} (UID: ${c.id}), invested: ${d.totalInvested}, networkSales: ${d.networkSales}`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
