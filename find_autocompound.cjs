const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const users = await db.collection('users').where('autoCompound', '==', true).get();
  if (users.size > 0) {
    const u = users.docs[0].data();
    console.log('User:', u.uid || u.id);
    const invs = await db.collection('investments').where('userId', '==', u.uid || u.id).where('status', '==', 'active').get();
    for (const invDoc of invs.docs) {
      console.log('Inv:', invDoc.id, 'Amount:', invDoc.data().amountUsdt);
      const bSnap = await db.collection('bonuses')
        .where('investmentId', '==', invDoc.id)
        .where('type', '==', 'roi')
        .get();
      let arr = [];
      bSnap.forEach(b => arr.push(b.data()));
      arr.sort((a,b) => b.settlementDate.localeCompare(a.settlementDate));
      arr.slice(0, 3).forEach(b => console.log('Bonus:', b.settlementDate, b.amountUsdt));
    }
  }
}
check().catch(console.error).finally(() => process.exit(0));
