const admin = require('firebase-admin');
const sa = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function checkUser() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('id', '==', 'moodo9569').get();
  
  const userDoc = snapshot.empty ? (await usersRef.where('username', '==', 'moodo9569').get()).docs[0] : snapshot.docs[0];
  if (!userDoc) {
    console.log('User not found.');
    return;
  }
  const user = userDoc.data();
  console.log('User keys:');
  for (let k in user) {
    console.log(`${k}: ${user[k]}`);
  }

  // Also get the full document of the transaction
  console.log('\n=== Transaction Details ===');
  const txDoc = await db.collection('transactions').doc('Nu3Bax85dyy8GVPwSwXx').get();
  const tx = txDoc.data();
  console.log(tx);
  process.exit(0);
}
checkUser().catch(console.error);
