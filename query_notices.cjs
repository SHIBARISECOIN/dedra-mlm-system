const admin = require('firebase-admin');
const fs = require('fs');

async function check() {
  const key = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(key) });
  const db = admin.firestore();
  const snap = await db.collection('announcements').orderBy('createdAt', 'desc').limit(2).get();
  snap.docs.forEach(d => {
     const data = d.data();
     console.log('ID:', d.id);
     console.log('Title KO:', data.title);
     console.log('Title EN:', data.title_en);
     console.log('Content EN:', data.content_en?.substring(0, 50));
  });
}
check();
