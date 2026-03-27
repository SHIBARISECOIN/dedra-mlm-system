const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  // Let's check audit logs for this target ID or action involving "withdrawal" that the system executed today.
  const auditSnap = await db.collection('auditLogs')
    .where('targetId', '==', 'if15SNgz8WUCS3FguLo8') // this was his withdrawal tx id
    .get();
  
  console.log("Audit Logs for his transaction:");
  auditSnap.forEach(d => console.log(d.data()));

  // Could he have requested withdrawal even though he didn't have 800 USDT bonus balance?
  // Let's find his original withdrawal request transaction before deletion, maybe from another backup if it exists, or just explain the mechanic.
}
run().catch(console.error).finally(() => process.exit(0));
