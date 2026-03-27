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
  db.collection('announcements').orderBy('createdAt', 'desc').limit(3).get().then(snap => {
    console.log('Size:', snap.size);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.isActive !== false)
      .sort((a, b) => {
        if ((b.isPinned ? 1 : 0) !== (a.isPinned ? 1 : 0))
          return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      })
      .slice(0, 3);
    console.log('Filtered size:', items.length);
    if(items.length > 0) {
      console.log('First:', items[0].title);
    }
    process.exit(0);
  });
}
