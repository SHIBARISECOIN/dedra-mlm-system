const admin = require('firebase-admin');
const fs = require('fs');

const content = fs.readFileSync('./sa.js', 'utf8');
const match = content.match(/const serviceAccount = ({[\s\S]*?});/);
if (match) {
  let saObjStr = match[1];
  let sa = eval('(' + saObjStr + ')');
  sa.private_key = sa.private_key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  
  const db = admin.firestore();
  db.collection('announcements').orderBy('createdAt', 'desc').limit(15).get().then(snap => {
    console.log('Got', snap.size, 'docs');
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
