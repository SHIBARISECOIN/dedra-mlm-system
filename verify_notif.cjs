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
        const usersRef = await db.collection('users').where('email', '==', 'hsy7948@deedra.com').get();
        if (usersRef.empty) {
            console.log("User not found!");
            return;
        }
        
        let uid = '';
        usersRef.forEach(doc => {
            console.log("User found:", doc.id, doc.data().email);
            uid = doc.id;
        });

        const notifs = await db.collection('notifications')
            .where('userId', '==', uid)
            .orderBy('createdAt', 'desc')
            .limit(3)
            .get();
            
        console.log(`Found ${notifs.size} recent notifications for ${uid}:`);
        notifs.forEach(n => {
            console.log(n.id, "=>", JSON.stringify(n.data(), null, 2));
        });
        
    } catch (e) {
        console.error(e);
    }
}
run();
