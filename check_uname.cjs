const admin = require('firebase-admin');
const fs = require('fs');

const content = fs.readFileSync('/home/user/webapp/check_true_downlines.cjs', 'utf-8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
const SERVICE_ACCOUNT = eval('(' + match[1] + ')');

if (!admin.apps.length) { admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) }); }
const db = admin.firestore();

async function check() {
    const doc1 = await db.collection('users').doc('Fwuwmh5zdxYIz3HQX1bwihG9vc13').get(); 
    console.log(doc1.data()?.username || 'No username');
}
check().catch(console.error);
