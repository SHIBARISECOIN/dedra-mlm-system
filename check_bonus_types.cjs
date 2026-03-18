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
  const bonusesSnap = await db.collection('bonuses').limit(100).get();
  const types = new Set();
  bonusesSnap.docs.forEach(d => types.add(d.data().type));
  console.log("Types:", Array.from(types));
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
