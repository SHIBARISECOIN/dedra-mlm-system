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
        await db.collection('events').doc('jackpot').set({ test: 1 }, { merge: true });
        console.log('Write success!');
    } catch(e) {
        console.error('Write failed:', e);
    }
}
test();
