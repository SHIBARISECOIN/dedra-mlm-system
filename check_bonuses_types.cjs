const admin = require('firebase-admin');
const sa = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function checkBonuses() {
  const uid = 'KM7pKoYx4lM2gUt1wKPgT2rl57M2';
  const snapshot = await db.collection('bonuses').where('userId', '==', uid).get();
  
  let types = {};
  snapshot.forEach(doc => {
    let type = doc.data().type;
    let amt = doc.data().amount || 0;
    if (!types[type]) types[type] = 0;
    types[type] += amt;
  });
  console.log('Bonus sums by type:', types);
  process.exit(0);
}
checkBonuses().catch(console.error);
