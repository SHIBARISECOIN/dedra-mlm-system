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
    const usersSnap = await db.collection('users').get();
    const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Find users with 'pb9824' in their email or name
    const matches = allUsers.filter(u => 
        (u.email && u.email.includes('pb9824')) || 
        (u.name && u.name.includes('pb9824'))
    );
    
    console.log(`Found ${matches.length} matching users:`);
    for (const u of matches) {
        console.log(`- UID: ${u.id}`);
        console.log(`  Name: ${u.name}`);
        console.log(`  Email: ${u.email}`);
        console.log(`  ReferredBy: ${u.referredBy || '없음 (None)'}`);
        console.log(`  CreatedAt: ${u.createdAt ? new Date(u.createdAt._seconds * 1000).toLocaleString('ko-KR') : '알 수 없음'}`);
        console.log('---');
    }
}

run().catch(console.error);
