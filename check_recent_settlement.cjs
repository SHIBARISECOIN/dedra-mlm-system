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
        const snap = await db.collection('settlements')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
            
        if (!snap.empty) {
            const data = snap.docs[0].data();
            console.log('Last Settlement ID:', snap.docs[0].id);
            console.log('Status:', data.status);
            console.log('Date:', data.date);
            console.log('Created At:', data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString() : 'N/A');
        } else {
            console.log('No settlements found.');
        }
    } catch(e) {
        console.error('Check failed:', e);
    }
}
checkStatus();
