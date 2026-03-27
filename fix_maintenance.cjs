const admin = require('firebase-admin');
const fs = require('fs');

const content = fs.readFileSync('./sa.js', 'utf8');
const match = content.match(/const serviceAccount = ({[\s\S]*?});/);
if (match) {
  let saObjStr = match[1];
  let sa = eval('(' + saObjStr + ')');
  sa.private_key = sa.private_key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa)
    });
  }
  
  const db = admin.firestore();
  db.collection('settings').doc('system').update({ maintenanceMode: false }).then(() => {
    console.log('maintenanceMode set to false.');
    process.exit(0);
  });
}
