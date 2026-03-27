const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function recalcAll() {
  console.log("Fetching all users...");
  const usersSnap = await db.collection('users').get();
  
  const users = {};
  const childrenMap = {}; // parent_uid -> array of child_uids
  
  usersSnap.forEach(d => {
    const data = d.data();
    users[d.id] = {
      uid: d.id,
      invested: data.totalInvested || 0,
      referredBy: data.referredBy || null,
      refCode: data.referralCode || null,
      networkSales: 0
    };
  });
  
  // Build tree
  for (const uid in users) {
    const parentId = users[uid].referredBy;
    if (parentId && users[parentId]) {
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(uid);
    }
  }
  
  // DFS to calculate actual network sales (sum of all descendants' invested amounts)
  const memo = {};
  function getSales(uid) {
    if (memo[uid] !== undefined) return memo[uid];
    
    let sum = 0;
    const children = childrenMap[uid] || [];
    for (const childId of children) {
      // Child's network sales = their invested + their descendants' invested
      sum += users[childId].invested + getSales(childId);
    }
    memo[uid] = sum;
    return sum;
  }
  
  console.log("Calculating network sales...");
  let updates = [];
  for (const uid in users) {
    const actualSales = getSales(uid);
    users[uid].networkSales = actualSales;
    
    const currentSales = usersSnap.docs.find(d => d.id === uid).data().networkSales || 0;
    if (actualSales !== currentSales) {
       updates.push({ uid, sales: actualSales, old: currentSales });
    }
  }
  
  console.log(`Found ${updates.length} users needing networkSales update.`);
  
  const batch = db.batch();
  let count = 0;
  for (const update of updates) {
    batch.update(db.collection('users').doc(update.uid), {
      networkSales: update.sales
    });
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      console.log(`Committed ${count} updates...`);
    }
  }
  if (count % 400 !== 0) {
    await batch.commit();
    console.log(`Committed remaining updates... Total: ${count}`);
  }
  
  console.log("Recalculation complete!");
}

recalcAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
