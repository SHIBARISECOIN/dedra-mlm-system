const admin = require('firebase-admin');
const fs = require('fs');
const XLSX = require('xlsx');

const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const cEm = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/)?.[1];
const pK = (idxContent.match(/private_key:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/)?.[1]).replace(/\\n/g, '\n');
const pId = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/)?.[1];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
}
const db = admin.firestore();

async function run() {
  const usersSnap = await db.collection('users').where('username', 'in', ['cyj0300']).get();
  for (const uDoc of usersSnap.docs) {
    console.log(`[cyj0300] Bonuses`);
    const bonusSnap = await db.collection('bonuses')
      .where('userId', '==', uDoc.id)
      .where('type', '==', 'daily_roi')
      .get();
      
    bonusSnap.docs.forEach(b => console.log(b.data().settlementDate || (b.data().createdAt && b.data().createdAt.toDate ? b.data().createdAt.toDate().toISOString().slice(0,10) : 'none'), b.data().amount, b.data().origin || 'sys'));
  }
}
run().then(() => process.exit(0)).catch(console.error);
