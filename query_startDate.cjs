const admin = require('firebase-admin');
const fs = require('fs');

async function check() {
  const key = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(key) });
  const db = admin.firestore();
  const snap = await db.collection('investments').limit(2).get();
  snap.docs.forEach(d => {
     console.log('startDate:', typeof d.data().startDate, d.data().startDate);
  });
}
check();
