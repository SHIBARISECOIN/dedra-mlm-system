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
        const uid = "mb4hYj4bb8ZWzPs1sAu4zNTf0o02";
        
        const notifs = await db.collection('notifications')
            .where('userId', '==', uid)
            .get();
            
        console.log(`Found ${notifs.size} recent notifications for ${uid}:`);
        let logs = [];
        notifs.forEach(n => {
            logs.push({id: n.id, data: n.data()});
        });
        
        logs.sort((a,b) => {
            let aT = a.data.createdAt ? (a.data.createdAt.toMillis ? a.data.createdAt.toMillis() : 0) : 0;
            let bT = b.data.createdAt ? (b.data.createdAt.toMillis ? b.data.createdAt.toMillis() : 0) : 0;
            return bT - aT;
        });
        
        logs.slice(0, 3).forEach(n => {
            let d = n.data;
            console.log(n.id, "=>", JSON.stringify({
                ...d, 
                createdAt: d.createdAt ? d.createdAt.toDate() : null
            }, null, 2));
        });
        
    } catch (e) {
        console.error(e);
    }
}
run();
