const admin = require('firebase-admin');
const fs = require('fs');

const content = fs.readFileSync('/home/user/webapp/check_true_downlines.cjs', 'utf-8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
const SERVICE_ACCOUNT = eval('(' + match[1] + ')');

if (!admin.apps.length) { 
    admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) }); 
}
const db = admin.firestore();

async function run() {
    const uids = ['1erxqe9iHrQO6xI1HUnzM0t34xW2', 'Fwuwmh5zdxYIz3HQX1bwihG9vc13'];
    
    for (const uid of uids) {
        const q = await db.collection('users').where('referredBy', '==', uid).get();
        console.log(`=== UID: ${uid} downlines ===`);
        q.forEach(d => {
            console.log(`  - ${d.data().name} (${d.data().email})`);
        });
    }
}

run().catch(console.error);
