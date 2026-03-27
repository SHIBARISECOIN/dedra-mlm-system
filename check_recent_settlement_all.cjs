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
        const snap = await db.collection('settlements').doc('2026-03-27').get();
            
        if (snap.exists) {
            console.log(snap.data());
        }
    } catch(e) {
        console.error('Check failed:', e);
    }
}
checkStatus();
