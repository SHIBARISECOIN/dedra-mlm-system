const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function run() {
    try {
        await db.collection('notifications').doc('IwjBPBjEZHWajJN7CcNg').delete();
        console.log("Deleted duplicate");
    } catch (e) {
        console.error(e);
    }
}
run();
