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
  const pid = parent.id;
  
  // Actually, how are we rendering the tree? By 'parentId' or 'sponsorId'?
  console.log("ssm9310 data:", parent.data().sponsorId, parent.data().parentId);
  
  const allUsers = await db.collection('users').get();
  
  let children = [];
  allUsers.forEach(u => {
    if (u.data().parentId === pid) {
      children.push(u.data());
    }
  });
  
  console.log(`Has ${children.length} direct children (by parentId)`);
  for (const c of children) {
    console.log(`- ${c.username}: invested ${c.totalInvested}, networkSales: ${c.networkSales}`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
