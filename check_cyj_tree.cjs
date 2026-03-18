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
  const uid = 'qAdGKU772oVGZ0B5PwUEbL3UqSF3';
  const l1 = await db.collection('users').where('referredBy', '==', uid).get();
  console.log('L1 count:', l1.size);
  
  for (const d1 of l1.docs) {
    const l2 = await db.collection('users').where('referredBy', '==', d1.id).get();
    console.log(` - ${d1.id} has ${l2.size} L2 downlines`);
    
    for (const d2 of l2.docs) {
      const l3 = await db.collection('users').where('referredBy', '==', d2.id).get();
      if (l3.size > 0) {
        console.log(`   - ${d2.id} has ${l3.size} L3 downlines`);
      }
    }
  }
}

run().catch(console.error);
