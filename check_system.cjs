const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function test() {
    try {
        const doc = await db.collection('settings').doc('system').get();
        console.log('System data:', doc.data());
    } catch(e) {
        console.error('Failed:', e);
    }
}
test();
