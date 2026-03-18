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
  const uid = userSnap.docs[0].id;
  
  const downlines = await usersRef.where('referredBy', '==', uid).get();
  console.log(`User cyj0300 (${uid}) has ${downlines.size} direct downlines.`);
  downlines.forEach(d => console.log(' -', d.id, d.data().username));
}

run().catch(console.error);
