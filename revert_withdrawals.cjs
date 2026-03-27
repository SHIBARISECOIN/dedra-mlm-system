const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function revert() {
  const batch = db.batch();
  
  // hsh17699 (46 USDT)
  batch.update(db.collection('transactions').doc('a2aBrAzeIrgQXgOAvZkB'), {
    status: 'held',
    adminMemo: '보류 처리',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // hsh176991 (83 USDT)
  batch.update(db.collection('transactions').doc('llYL04A8DG4RpNcr8aVG'), {
    status: 'held',
    adminMemo: '보류 처리',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();
  console.log("Successfully reverted both withdrawals to 'held'.");
}

revert().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
