const admin = require('firebase-admin');
const fs = require('fs');
const content = fs.readFileSync('./sa.js', 'utf8');
const match = content.match(/const serviceAccount = ({[\s\S]*?});/);
if (match) {
  let sa = eval('(' + match[1] + ')');
  sa.private_key = sa.private_key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
  admin.firestore().collection('announcements').orderBy('createdAt', 'desc').get().then(snap => {
    snap.forEach(doc => {
      console.log(doc.id, 'isActive:', doc.data().isActive, 'isPinned:', doc.data().isPinned, 'title:', doc.data().title);
    });
    process.exit(0);
  });
}
