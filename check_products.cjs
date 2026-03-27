const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkProducts() {
  const pSnap = await db.collection('products').get();
  pSnap.forEach(d => {
    console.log(d.id, d.data());
  });
}

checkProducts().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
