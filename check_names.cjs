const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const users = await db.collection('users').where('name', '==', '강영준').get();
  console.log("Users named 강영준:", users.size);
  users.forEach(u => console.log(u.id, u.data().email));
}
check().catch(console.error).finally(() => process.exit(0));
