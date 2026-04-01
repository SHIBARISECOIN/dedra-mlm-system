const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkConfig() {
    const snap = await db.collection('settings').doc('config').get();
    if (snap.exists) {
        console.log("Config Settings:", snap.data());
    } else {
        console.log("Config settings not found.");
    }
    process.exit(0);
}
checkConfig().catch(console.error);
