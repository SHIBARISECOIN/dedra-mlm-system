const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const auditLogs = await db.collection('auditLogs')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();
    
  auditLogs.forEach(doc => {
    const data = doc.data();
    if (data.action.toLowerCase().includes('withdraw') || data.action.toLowerCase().includes('보류') || data.action.toLowerCase().includes('held')) {
       console.log(`[${data.timestamp?.toDate().toISOString()}] Admin ${data.adminEmail || data.adminUid} performed ${data.action} on ${data.targetId}`);
    }
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
