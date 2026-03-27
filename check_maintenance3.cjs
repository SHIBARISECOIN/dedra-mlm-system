const admin = require('firebase-admin');
const fs = require('fs');

try {
  const content = fs.readFileSync('./sa.js', 'utf8');
  let serviceAccount;
  // Use eval to safely load the JS object
  eval(content + '\n serviceAccount = serviceAccount;');
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  
  const db = admin.firestore();
  db.collection('settings').doc('system').get().then(doc => {
    if (doc.exists) {
      console.log('MAINTENANCE_DATA:', JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('MAINTENANCE_DATA: Document does not exist');
    }
    process.exit(0);
  }).catch(err => {
    console.error('Error fetching doc:', err);
    process.exit(1);
  });
} catch(e) {
  console.error('Error parsing sa.js or initializing:', e);
  process.exit(1);
}
