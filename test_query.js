const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function test() {
  const cyjRef = await db.collection('users').where('username', '==', 'cyj0300').get();
  if (cyjRef.empty) return console.log('user not found');
  const user = cyjRef.docs[0];
  
  const q1 = db.collection('users').where('referredBy', '==', user.id);
  const snap1 = await q1.get();
  console.log('q1 count:', snap1.size);
  
  // try with limit 1
  const qLimit = db.collection('users').where('referredBy', '==', snap1.docs[0].id).limit(1);
  const snapL = await qLimit.get();
  console.log('qLimit count:', snapL.size);
}
test().catch(console.error);
