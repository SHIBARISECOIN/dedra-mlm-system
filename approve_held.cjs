const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const t1 = await db.collection('transactions').doc('a2aBrAzeIrgQXgOAvZkB').get();
  const t2 = await db.collection('transactions').doc('llYL04A8DG4RpNcr8aVG').get();
  
  console.log("Found hsh17699 tx status:", t1.data().status);
  console.log("Found hsh176991 tx status:", t2.data().status);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
