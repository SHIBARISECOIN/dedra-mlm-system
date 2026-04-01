const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/serviceAccountKey.json', 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function run() {
    const uids = ['AZXEcOvrSATvDXdlFtJIitWEU3q1', 'T22NSRBNSwbXivSF26JLChgWw0G3', 'loSNb9m5qKTQsVqie2AtqWKChmx1'];
    for (let uid of uids) {
        const doc = await db.collection('users').doc(uid).get();
        console.log(`\nUID: ${uid}`);
        console.log(doc.data());
    }
}
run().catch(console.error).finally(() => process.exit(0));
