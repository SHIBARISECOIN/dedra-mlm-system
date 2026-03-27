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
  console.log("ssm9310 (UID:", parent.id, ") invested:", parent.data().totalInvested);
  
  const children = await db.collection('users').where('sponsorId', '==', parent.id).get();
  console.log(`Has ${children.size} direct children`);
  
  let totalChildInvest = 0;
  for (const c of children.docs) {
    console.log(`- ${c.data().username}: invested ${c.data().totalInvested}`);
    totalChildInvest += (c.data().totalInvested || 0);
    
    // Check grand children
    const gchildren = await db.collection('users').where('sponsorId', '==', c.id).get();
    let gcSum = 0;
    gchildren.forEach(gc => gcSum += (gc.data().totalInvested || 0));
    console.log(`  └ Grandchildren sum: ${gcSum}`);
    totalChildInvest += gcSum;
  }
  
  console.log(`\nTotal Expected Tree Sales (Parent + All descendants): ${(parent.data().totalInvested || 0) + totalChildInvest}`);
}
run().then(() => process.exit(0)).catch(console.error);
