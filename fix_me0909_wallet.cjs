const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); 

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', 'me0909@deedra.com').get();
  
  if (snapshot.empty) return;
  
  for (const doc of snapshot.docs) {
    await db.collection('wallets').doc(doc.id).update({
        totalDeposit: 15000
    });
    console.log(`Updated wallet for ${doc.id} (me0909) totalDeposit to 15000 to bypass noDeposit rule.`);
  }
}
run().catch(console.error);
