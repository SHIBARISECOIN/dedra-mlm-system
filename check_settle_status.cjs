const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function checkStatus() {
    try {
        const snap = await db.collection('settings').doc('system').get();
        if (snap.exists) {
            const data = snap.data();
            console.log('Maintenance Mode:', data.maintenanceMode);
            console.log('Maintenance Message:', data.maintenanceMessage);
            console.log('Is Settling:', data.isSettling);
        } else {
            console.log('System settings doc not found');
        }
        
        // Also check if there's any active settlement lock
        const settleLock = await db.collection('settings').doc('settlement_lock').get();
        if (settleLock.exists) {
            console.log('Settlement Lock:', settleLock.data());
        } else {
            console.log('No settlement lock found.');
        }
    } catch(e) {
        console.error('Check failed:', e);
    }
}
checkStatus();
