const admin = require('firebase-admin');
const fs = require('fs');

const saContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const clientEmail = saContent.match(/client_email:\s*"([^"]+)"/)[1];
const privateKey = saContent.match(/private_key:\s*"([^"]+)"/)[1].replace(/\\n/g, '\n');
const projectId = saContent.match(/project_id:\s*"([^"]+)"/)[1];

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}
const db = admin.firestore();

async function check() {
  const usersSnapshot = await db.collection('users').where('username', '==', 'cyj0300').get();
  if (usersSnapshot.empty) {
    console.log("User cyj0300 not found");
    return;
  }
async function check() {
  const ws = await db.collection('wallets').limit(3).get();
  ws.docs.forEach(d => {
    console.log(d.id, "userId field:", d.data().userId);
  });
}
check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
