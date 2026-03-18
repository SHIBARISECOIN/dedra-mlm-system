const admin = require('firebase-admin');
const fs = require('fs');
const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const cEm = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/)?.[1];
const pK = (idxContent.match(/private_key:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/)?.[1]).replace(/\\n/g, '\n');
const pId = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/)?.[1];
admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
const db = admin.firestore();

async function run() {
  const b = await db.collection('bonuses').limit(100).get();
  const bTypes = new Set();
  b.docs.forEach(d => bTypes.add(d.data().type));
  console.log("Bonus Types:", Array.from(bTypes));
  
  const t = await db.collection('transactions').limit(100).get();
  const tTypes = new Set();
  t.docs.forEach(d => tTypes.add(d.data().type));
  console.log("Tx Types:", Array.from(tTypes));
}
run().then(() => process.exit(0));
