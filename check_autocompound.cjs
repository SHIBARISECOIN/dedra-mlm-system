const admin = require('firebase-admin');
const serviceAccount = require('/home/user/webapp/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const invs = await db.collection('investments').get();
  
  let targetDate = '2026-03-31';
  let settledToday = [];
  
  invs.forEach(doc => {
    let data = doc.data();
    let lsa = data.lastSettledAt;
    if (lsa && typeof lsa === 'string' && lsa.startsWith(targetDate)) {
      settledToday.push(doc);
    } else if (lsa && lsa.toDate && lsa.toDate().toISOString().startsWith(targetDate)) {
      settledToday.push(doc);
    }
  });
  
  const bonuses = await db.collection('bonuses')
    .where('settlementDate', '==', targetDate)
    .get();
  
  let bonusesByInv = {};
  bonuses.forEach(b => {
    let data = b.data();
    if (data.type === 'roi' && data.investmentId) {
      bonusesByInv[data.investmentId] = true;
    }
  });
  
  let missingInvs = [];
  for (let doc of settledToday) {
    if (!bonusesByInv[doc.id]) missingInvs.push(doc);
  }
  
  let acCount = 0;
  for (let doc of missingInvs) {
    // wait, we need to check if the user has autoCompound enabled, but we don't know for sure.
    // Let's just check if their amount today is a clean number, or if we can see the history.
    console.log(`Inv: ${doc.id}, Amount: ${doc.data().amount}, amountUsdt: ${doc.data().amountUsdt}`);
    if (doc.data().amount % 1 !== 0) {
        acCount++;
    }
  }
  console.log(`Potential auto-compounded investments: ${acCount} / ${missingInvs.length}`);
  process.exit(0);
}

check().catch(console.error);
