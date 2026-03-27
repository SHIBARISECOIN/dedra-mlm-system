const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Need a recursive function to find ALL descendants
async function getDescendants(uid) {
  let sum = 0;
  let count = 0;
  const children = await db.collection('users').where('referredBy', '==', uid).get();
  for (const c of children.docs) {
    sum += (c.data().totalInvested || 0);
    count++;
    const sub = await getDescendants(c.id);
    sum += sub.sum;
    count += sub.count;
  }
  return { sum, count };
}

async function run() {
  const users = ['ssm9310', 'pdh8949'];
  for (const un of users) {
    const q1 = await db.collection('users').where('username', '==', un).get();
    if (q1.empty) continue;
    const user = q1.docs[0];
    const uid = user.id;
    console.log(`User: ${un}`);
    
    const desc = await getDescendants(uid);
    console.log(`  => Total descendants invested: ${desc.sum} (${desc.count} users)`);
    console.log(`  => Self invested: ${user.data().totalInvested || 0}`);
    console.log(`  => Total Sales (Self + Descendants): ${(user.data().totalInvested || 0) + desc.sum}`);
    console.log(`  => DB networkSales (Descendants only): ${user.data().networkSales}`);
    console.log(`  => DB totalSales: ${user.data().totalSales}`);
    console.log('---');
  }
}
run().then(() => process.exit(0)).catch(console.error);
