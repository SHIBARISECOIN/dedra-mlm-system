const admin = require('firebase-admin');
const fs = require('fs');

const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf-8');
const project_id = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1] || '';
const client_email = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1] || '';
const private_key = idxContent.match(/private_key:\s*"([^"]+)"/)?.[1].replace(/\\n/g, '\n') || '';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ project_id, client_email, private_key })
  });
}
const db = admin.firestore();

async function run() {
  const usersRef = db.collection('users');
  const userSnap = await usersRef.where('username', '==', 'cyj0300').get();
  if (userSnap.empty) {
    console.log('User cyj0300 not found');
    return;
  }
  const user = userSnap.docs[0];
  const uid = user.id;
  console.log('cyj0300 UID:', uid);
  
  const wSnap = await db.collection('wallets').doc(uid).get();
  console.log('Wallet:', wSnap.data());
  
  const invSnap = await db.collection('investments').where('userId', '==', uid).where('status', '==', 'active').get();
  console.log('Active Investments:');
  invSnap.forEach(d => console.log(d.id, d.data()));
}

run().catch(console.error);
