const admin = require('firebase-admin');
const fs = require('fs');
const saContent = fs.readFileSync('/home/user/webapp/sa.js', 'utf8').replace('const SERVICE_ACCOUNT = ', '').replace(/};\s*$/, '}');
const SERVICE_ACCOUNT = eval('(' + saContent + ')');
admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
const db = admin.firestore();

async function run() {
  await db.collection('settlements').doc('2026-03-18').delete();
  console.log("Lock cleared for 2026-03-18");
}
run().catch(console.error);
