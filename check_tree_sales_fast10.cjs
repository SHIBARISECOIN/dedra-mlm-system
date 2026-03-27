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
    const uid = user.id;
    console.log(`User: ${un} (UID: ${uid})`);
    
    // Find who refers to this UID
    const children = await db.collection('users').where('referredBy', '==', uid).get();
    let cSum = 0;
    let descCount = 0;
    
    for (const c of children.docs) {
      console.log(`  - Child: ${c.data().username}, invested: ${c.data().totalInvested}`);
      cSum += (c.data().totalInvested || 0);
      descCount++;
      
      const gc = await db.collection('users').where('referredBy', '==', c.id).get();
      for (const g of gc.docs) {
        console.log(`    - GrandChild: ${g.data().username}, invested: ${g.data().totalInvested}`);
        cSum += (g.data().totalInvested || 0);
        descCount++;
      }
    }
    console.log(`  => Total descendants invested: ${cSum} (${descCount} users)`);
    console.log(`  => Self invested: ${user.data().totalInvested || 0}`);
    console.log(`  => Actual Network Sales should be: ${cSum}`);
    console.log(`  => Current DB networkSales: ${user.data().networkSales}`);
    console.log('---');
  }
}
run().then(() => process.exit(0)).catch(console.error);
