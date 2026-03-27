const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection('announcements').orderBy('createdAt', 'desc').limit(5).get();
    console.log(`Found ${snap.size} announcements.`);
    snap.forEach(doc => console.log(doc.id, doc.data().title));
}
check();
