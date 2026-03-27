const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  // It's hard to find deleted transactions, but we can check if they existed in audit logs or notification logs.
  const notifSnap = await db.collection('notifications').where('userId', '==', uid).get();
  console.log(`\n[Notifications for user: ${notifSnap.size}]`);
  notifSnap.forEach(d => {
      console.log(d.data());
  });

}
run().catch(console.error).finally(() => process.exit(0));
