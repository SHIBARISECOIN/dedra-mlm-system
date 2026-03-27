const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function check() {
  const users = await db.collection('users').where('email', '==', 'btc100@deedra.com').get();
  if (users.empty) {
    console.log("btc100 not found");
  } else {
    users.forEach(u => console.log("User:", u.data().email, u.id));
  }
}
check().catch(console.error).finally(() => process.exit(0));
