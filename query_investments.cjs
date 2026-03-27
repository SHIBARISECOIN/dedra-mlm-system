const admin = require('firebase-admin');
const fs = require('fs');

async function checkInvestments() {
  const key = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(key)
    });
  }
  const db = admin.firestore();
  const uid = 'KM7pKoYx4lM2gUt1wKPgT2rl57M2';
  const snap = await db.collection('investments').where('userId', '==', uid).get();
  console.log('Total for user:', snap.size);
  snap.docs.forEach(d => {
     console.log(d.id, d.data().status, d.data().productName, d.data().amount);
  });
}
checkInvestments();
