const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  await db.collection('users').doc(uid).update({
      status: 'suspended',
      suspendReason: '데이터 조작 및 어뷰징 시도 적발'
  });
  console.log("hsy7948 suspended successfully.");
}
run().catch(console.error).finally(() => process.exit(0));
