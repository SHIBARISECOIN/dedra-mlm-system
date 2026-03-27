const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function fix() {
    try {
        await db.collection('settings').doc('system').set({
            maintenanceMode: false,
            isSettling: false
        }, { merge: true });
        console.log('Maintenance mode turned OFF successfully.');
    } catch(e) {
        console.error('Fix failed:', e);
    }
}
fix();
