const admin = require('firebase-admin');
const fs = require('fs');

const content = fs.readFileSync('/home/user/webapp/check_true_downlines.cjs', 'utf-8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
const SERVICE_ACCOUNT = eval('(' + match[1] + ')');

if (!admin.apps.length) { admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) }); }
const db = admin.firestore();

async function run() {
    const uids = ['1erxqe9iHrQO6xI1HUnzM0t34xW2', 'Fwuwmh5zdxYIz3HQX1bwihG9vc13'];
    
    for (const uid of uids) {
        const doc = await db.collection('users').doc(uid).get();
        console.log(`\n=== UID: ${uid} (${doc.data().email}) ===`);
        
        const invQ = await db.collection('investments').where('userId', '==', uid).get();
        console.log(`Investments: ${invQ.size}`);
        invQ.forEach(d => console.log(`  - Amount: ${d.data().amount}, Status: ${d.data().status}`));
        
        const wDoc = await db.collection('wallets').doc(uid).get();
        if(wDoc.exists) console.log(`Wallet totalInvest: ${wDoc.data().totalInvest}`);
    }
}
run().catch(console.error);
