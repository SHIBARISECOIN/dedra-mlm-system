const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const heldWithdrawals = await db.collection('transactions')
    .where('userId', 'in', ['jIbtjHYEEdYw3mvjZ2Ski0cqwzq1', 'G4CHFevpFUdf5NbiZsbcUDaLtwX2'])
    .where('type', '==', 'withdrawal')
    .get();
    
  heldWithdrawals.forEach(doc => {
    const data = doc.data();
    console.log(`TxID: ${doc.id}`);
    console.log(`  User: ${data.userId}`);
    console.log(`  Date: ${data.createdAt?.toDate().toISOString()}`);
    console.log(`  Amount: ${data.amountUsdt || data.amount} USDT`);
    console.log(`  Status: ${data.status}`);
    console.log(`  adminMemo: ${data.adminMemo || 'None'}`);
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
