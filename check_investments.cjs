const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkDownlineInvestments(targetUid) {
  const snap = await db.collection('users').get();
  const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const childrenMap = {};
  allUsers.forEach(u => {
    const parentId = u.referredBy;
    if (parentId) {
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(u);
    }
  });
  
  const downlineUids = new Set();
  function traverse(uid) {
    const children = childrenMap[uid] || [];
    for (const child of children) {
      downlineUids.add(child.id);
      traverse(child.id);
    }
  }
  traverse(targetUid);
  
  console.log(`Found ${downlineUids.size} downline members.`);
  
  const invSnap = await db.collection('investments').where('status', '==', 'active').get();
  let totalActiveInvestFromInvestments = 0;
  let missingOrMismatched = [];
  
  const investByUid = {};
  invSnap.docs.forEach(d => {
    const data = d.data();
    if (downlineUids.has(data.userId)) {
      const amt = parseFloat(data.amountUsdt || data.amount || 0);
      totalActiveInvestFromInvestments += amt;
      investByUid[data.userId] = (investByUid[data.userId] || 0) + amt;
    }
  });
  
  let totalActiveFromUsers = 0;
  downlineUids.forEach(uid => {
    const u = allUsers.find(x => x.id === uid);
    const uInvest = parseFloat(u.totalInvested || 0);
    totalActiveFromUsers += uInvest;
    
    const trueInvest = investByUid[uid] || 0;
    if (Math.abs(uInvest - trueInvest) > 0.1) {
      missingOrMismatched.push({
        uid, 
        email: u.email,
        userDocValue: uInvest,
        investmentsValue: trueInvest
      });
    }
  });
  
  console.log(`Total from user docs: ${totalActiveFromUsers}`);
  console.log(`Total from investments col: ${totalActiveInvestFromInvestments}`);
  console.log(`Mismatched users: ${missingOrMismatched.length}`);
  if (missingOrMismatched.length > 0) {
      console.log(missingOrMismatched.slice(0, 10)); // just print first 10
  }
}

checkDownlineInvestments('qAdGKU772oVGZ0B5PwUEbL3UqSF3').catch(console.error);
