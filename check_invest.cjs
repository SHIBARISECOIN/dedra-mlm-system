const admin = require('firebase-admin');

const fs = require('fs');
const content = fs.readFileSync('/home/user/webapp/check_true_downlines.cjs', 'utf-8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
// This regex matches a JS object, let's eval it
const SERVICE_ACCOUNT = eval('(' + match[1] + ')');

if (!admin.apps.length) { admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) }); }
const db = admin.firestore();

async function run() {
  const q = await db.collection('investments').where('userId', '==', 'qAdGKU772oVGZ0B5PwUEbL3UqSF3').get();
  console.log(`CYJ0300 Investments: ${q.size}`);
  let totalActive = 0;
  q.forEach(doc => {
      const d = doc.data();
      console.log(`- Amount: ${d.amount}, Status: ${d.status}`);
      if(d.status === 'active') totalActive += d.amount;
  });
  console.log(`Total Active Amount: ${totalActive}`);
}
run().catch(console.error);
