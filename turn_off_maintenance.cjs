const admin = require('firebase-admin');
const serviceAccount = require('/home/user/webapp/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function turnOffMaintenance() {
  await db.collection('settings').doc('system').update({
    maintenanceMode: false
  });
  console.log('Maintenance mode turned OFF successfully.');
  process.exit(0);
}

turnOffMaintenance().catch(console.error);
