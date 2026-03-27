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
    console.log(`User: ${un} keys: ${Object.keys(user.data()).join(', ')}`);
  }
}
run().then(() => process.exit(0)).catch(console.error);
