const admin = require('firebase-admin');
const fs = require('fs');

const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const cEm = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/)?.[1];
const pK = (idxContent.match(/private_key:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/)?.[1]).replace(/\\n/g, '\n');
const pId = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/)?.[1];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
}
const db = admin.firestore();

async function run() {
  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  let batch = db.batch();
  let count = 0;
  
  for(const iDoc of invSnap.docs) {
    const data = iDoc.data();
    if(typeof data.startDate === 'object' && data.startDate && typeof data.startDate.toDate === 'function') {
      batch.update(iDoc.ref, { startDate: data.startDate.toDate().toISOString().slice(0, 10) });
      count++;
    } else if (typeof data.startDate === 'object' && data.startDate && data.startDate._seconds) {
      batch.update(iDoc.ref, { startDate: new Date(data.startDate._seconds * 1000).toISOString().slice(0, 10) });
      count++;
    }
    
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  
  if(count > 0) await batch.commit();
  console.log("Fixed [object Object] dates.");
}
run().then(() => process.exit(0)).catch(console.error);
