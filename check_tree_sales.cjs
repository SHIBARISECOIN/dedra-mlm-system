const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const usernames = ['ssm9310', 'kcy9313', 'pdh8949', 'csr5543'];
  let userMap = {};
  
  for (const un of usernames) {
    const usersSnap = await db.collection('users').where('username', '==', un).get();
    if (!usersSnap.empty) {
      const uid = usersSnap.docs[0].id;
      const data = usersSnap.docs[0].data();
      userMap[un] = { uid, ...data };
    }
  }
  
  if (!userMap['ssm9310']) {
    console.log("Could not find user ssm9310");
    return;
  }
  
  const parentUid = userMap['ssm9310'].uid;
  console.log(`Parent ssm9310 (UID: ${parentUid}) data:`);
  console.log(`  본인 매출 (totalInvested): ${userMap['ssm9310'].totalInvested}`);
  
  const wDoc = await db.collection('wallets').doc(parentUid).get();
  console.log(`  Wallet totalInvest: ${wDoc.data()?.totalInvest}`);
  
  // Find children
  const childrenSnap = await db.collection('users').where('sponsorId', '==', parentUid).get();
  console.log(`\nChildren found for ssm9310: ${childrenSnap.size}`);
  
  let childrenSum = 0;
  for (const doc of childrenSnap.docs) {
    const child = doc.data();
    console.log(`  Child ${child.username} (UID: ${doc.id})`);
    console.log(`    totalInvested: ${child.totalInvested || 0}`);
    
    // Check their children (grand children)
    const grandChildrenSnap = await db.collection('users').where('sponsorId', '==', doc.id).get();
    let grandSum = 0;
    for (const gdoc of grandChildrenSnap.docs) {
      grandSum += (gdoc.data().totalInvested || 0);
    }
    console.log(`    Sub-tree totalInvested (grand children): ${grandSum}`);
    
    childrenSum += (child.totalInvested || 0) + grandSum;
  }
  
  console.log(`\nExpected 전체 합계 (본인 + 하위 전체): ${(userMap['ssm9310'].totalInvested || 0) + childrenSum}`);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
