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
        const doc = await db.collection('events').doc('jackpot').get();
        console.log('Jackpot data:', doc.data());
    } catch(e) {
        console.error('Failed:', e);
    }
}
test();
