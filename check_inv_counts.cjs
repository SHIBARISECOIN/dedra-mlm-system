const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function check() {
  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  const userInvs = {};
  invSnap.forEach(d => {
    const i = d.data();
    userInvs[i.userId] = (userInvs[i.userId] || 0) + 1;
  });
  const multiples = Object.entries(userInvs).filter(x => x[1] > 1);
  console.log('Total active investments:', invSnap.size);
  console.log('Users with multiple active investments:', multiples.length);
  console.log(multiples);
}
check().catch(console.error).finally(() => process.exit(0));
