const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkDownline(targetUid) {
  const snap = await db.collection('users').get();
  const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Find target
  const targetUser = allUsers.find(u => u.id === targetUid);
  if (!targetUser) {
    console.log('Target user not found');
    return;
  }
  
  console.log(`Target: ${targetUser.name} (${targetUser.email}), My Invest: ${targetUser.totalInvested || 0}`);
  
  // Build tree
  const childrenMap = {};
  allUsers.forEach(u => {
    const parentId = u.referredBy;
    if (parentId) {
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(u);
    }
  });
  
  let totalDownlineInvest = 0;
  let totalTeamMembers = 0;
  let levelCounts = {};

  function traverse(uid, level) {
    const children = childrenMap[uid] || [];
    for (const child of children) {
      const invest = child.totalInvested || 0;
      totalDownlineInvest += invest;
      totalTeamMembers++;
      
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      
      traverse(child.id, level + 1);
    }
  }

  traverse(targetUid, 1);
  
  console.log(`--- Downline Stats ---`);
  console.log(`Total Members: ${totalTeamMembers}`);
  console.log(`Total Downline Investment: ${totalDownlineInvest} USDT`);
  console.log(`Level Counts:`, levelCounts);
  
  // Compare with stored value if any
  console.log(`Stored target downline volume (if exists):`, targetUser.downlineVolume || 'N/A');
}

checkDownline('qAdGKU772oVGZ0B5PwUEbL3UqSF3').catch(console.error);
