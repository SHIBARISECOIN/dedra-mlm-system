const admin = require('firebase-admin');
const serviceAccount = require('/home/user/webapp/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function checkSystem() {
  const doc = await db.collection('settings').doc('system').get();
  console.log(doc.data());
  process.exit(0);
}

checkSystem().catch(console.error);
