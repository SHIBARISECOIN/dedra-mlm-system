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
  const usersSnapshot = await db.collection('users').where('username', '==', 'big001').get();
  const u = usersSnapshot.docs[0].data();
  console.log("big001 id:", u.uid);

  const w = await db.collection('wallets').doc(u.uid).get();
  console.log("Wallet data:", w.data());

  const w2 = await db.collection('wallets').where('userId', '==', u.uid).get();
  console.log("Wallet by userId search size:", w2.size);
  if (w2.size > 0) console.log("Wallet by userId data:", w2.docs[0].data());
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
