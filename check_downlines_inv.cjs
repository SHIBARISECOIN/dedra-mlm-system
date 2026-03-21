const admin = require('firebase-admin');
const fs = require('fs');

const content = fs.readFileSync('/home/user/webapp/check_true_downlines.cjs', 'utf-8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
const SERVICE_ACCOUNT = eval('(' + match[1] + ')');

if (!admin.apps.length) { admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) }); }
const db = admin.firestore();

async function run() {
    const downlines = ['kjkyung048@naver.com', 'suoul@gmail.com'];
    
    for (const email of downlines) {
        const q = await db.collection('users').where('email', '==', email).get();
        if(!q.empty) {
            const uid = q.docs[0].id;
            console.log(`\n=== Downline: ${email} (UID: ${uid}) ===`);
            const invQ = await db.collection('investments').where('userId', '==', uid).get();
            console.log(`Investments: ${invQ.size}`);
            invQ.forEach(d => console.log(`  - Amount: ${d.data().amount}, Status: ${d.data().status}`));
        }
    }
}
run().catch(console.error);
