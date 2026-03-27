const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const pdh = await db.collection('users').where('username', '==', 'pdh8949').get();
  console.log('pdh8949 id:', pdh.docs[0].id);
  
  const children = await db.collection('users').get();
  let cnt = 0;
  for (const c of children.docs) {
    if (c.data().sponsorId === pdh.docs[0].id) {
       console.log(`Child found via sponsorId: ${c.data().username}`);
       cnt++;
    }
  }
  console.log('Direct children count:', cnt);
  
  // also check other ways of linking
  console.log('pdh8949 referralLink:', pdh.docs[0].data().referralCode);
}
run().then(() => process.exit(0)).catch(console.error);
