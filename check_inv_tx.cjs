const admin = require('firebase-admin');
const fs = require('fs');
const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const cEm = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1];
const pK = idxContent.match(/private_key:\s*"([^"]+)"/)?.[1].replace(/\\n/g, '\n');
const pId = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1];
admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
const db = admin.firestore();

async function run() {
  const t = await db.collection('transactions').where('type', 'in', ['invest', 'investment']).limit(10).get();
  t.docs.forEach(d => console.log(d.data()));
}
run().then(() => process.exit(0));
