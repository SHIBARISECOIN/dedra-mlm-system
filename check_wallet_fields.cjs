const admin = require('firebase-admin');
const fs = require('fs');

const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const cEm = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/)?.[1];
const pK = (idxContent.match(/private_key:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/)?.[1]).replace(/\\n/g, '\n');
const pId = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/)?.[1];
admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
const db = admin.firestore();

async function run() {
  const usersSnap = await db.collection('users').where('username', '==', 'big001').get();
  const uid = usersSnap.docs[0].id;
  const wSnap = await db.collection('wallets').doc(uid).get();
  const data = wSnap.data();
  console.log("Wallet fields for big001:", Object.keys(data));
  console.log("Has userId?", 'userId' in data);
}
run().then(() => process.exit(0));
