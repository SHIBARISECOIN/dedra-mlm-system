const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function test() {
  const snap = await db.collection('announcements').where('isActive', '==', true).get();
  console.log('Docs fetched:', snap.size);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, data.createdAt);
  });
}
test().catch(console.error);
