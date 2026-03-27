const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function approve() {
  const batch = db.batch();
  
  // hsh17699 (46 USDT)
  batch.update(db.collection('transactions').doc('a2aBrAzeIrgQXgOAvZkB'), {
    status: 'approved',
    adminMemo: '승인 완료',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // hsh176991 (83 USDT)
  batch.update(db.collection('transactions').doc('llYL04A8DG4RpNcr8aVG'), {
    status: 'approved',
    adminMemo: '승인 완료',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();
  console.log("Successfully approved both withdrawals.");
}

approve().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
