const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function check() {
  const usersSnap = await db.collection('users').get();
  const users = {};
  usersSnap.forEach(d => {
    users[d.id] = { ...d.data(), id: d.id };
  });

  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  const invByUser = {};
  let yesterdayInvSum = 0;
  let yesterdayInvCount = 0;
  
  // Set timeframe for yesterday (based on server time, roughly March 25)
  const yesterdayStart = new Date('2026-03-25T00:00:00Z').getTime();
  const yesterdayEnd = new Date('2026-03-25T23:59:59.999Z').getTime();

  invSnap.forEach(d => {
    const inv = d.data();
    const uid = inv.userId;
    const amt = inv.amount || 0;
    
    if (!invByUser[uid]) invByUser[uid] = 0;
    invByUser[uid] += amt;
    
    let time = 0;
    if (inv.createdAt && inv.createdAt._seconds) {
        time = inv.createdAt._seconds * 1000;
    } else if (inv.createdAt && typeof inv.createdAt.toMillis === 'function') {
        time = inv.createdAt.toMillis();
    } else if (inv.createdAt) {
        time = new Date(inv.createdAt).getTime();
    }
    
    if (time >= yesterdayStart && time <= yesterdayEnd) {
        yesterdayInvSum += amt;
        yesterdayInvCount++;
    }
  });

  let mismatches = [];
  for (const uid in invByUser) {
    const actualSum = invByUser[uid];
    const userRec = users[uid];
    const recordedSum = userRec ? (userRec.totalInvested || 0) : 0;
    
    if (Math.abs(actualSum - recordedSum) > 0.01) {
        mismatches.push({
            uid,
            username: userRec ? userRec.username : 'Unknown',
            actual: actualSum,
            recorded: recordedSum,
            diff: actualSum - recordedSum
        });
    }
  }

  console.log(`Yesterday's (Mar 25) active investments: ${yesterdayInvCount} count, ${yesterdayInvSum} USDT total`);
  console.log(`Mismatches between actual active investments sum and users.totalInvested: ${mismatches.length}`);
  if (mismatches.length > 0) {
    console.log(mismatches.slice(0, 15));
  } else {
    console.log("All users' totalInvested perfectly match their active investments.");
  }
}
check().catch(console.error).finally(() => process.exit(0));
