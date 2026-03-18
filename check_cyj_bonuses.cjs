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
  const q = await db.collection('bonuses').where('userId', '==', 'qAdGKU772oVGZ0B5PwUEbL3UqSF3').get();
  console.log(`User cyj0300 has ${q.size} bonuses.`);
  const types = {};
  q.forEach(d => {
    const t = d.data().type;
    types[t] = (types[t] || 0) + 1;
  });
  console.log('Bonus types:', types);
}

run().catch(console.error);
