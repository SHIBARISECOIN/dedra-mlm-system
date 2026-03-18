const admin = require('firebase-admin');
const fs = require('fs');
const saContent = fs.readFileSync('/home/user/webapp/sa.js', 'utf8').replace('const SERVICE_ACCOUNT = ', '').replace(/};\s*$/, '}');
const SERVICE_ACCOUNT = eval('(' + saContent + ')');
admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
const db = admin.firestore();
async function run() {
  const w = await db.collection('wallets').doc('rlSK0MotrUT1AbEXlSAmolfKpZ42').get();
  console.log("Wallet:", w.data());
}
run().catch(console.error);
