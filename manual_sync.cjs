const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function run() {
  console.log('Fetching users and wallets...');
  const usersSnap = await db.collection('users').get();
  const walletsSnap = await db.collection('wallets').get();
  
  const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const walletMap = {};
  walletsSnap.docs.forEach(d => {
    walletMap[d.id] = d.data().totalInvested || d.data().totalInvest || 0;
  });
  
  const childrenMap = {};
  allUsers.forEach(u => childrenMap[u.id] = []);
  allUsers.forEach(u => {
    if (u.referredBy && childrenMap[u.referredBy]) {
      childrenMap[u.referredBy].push(u.id);
    }
  });
  
  const nodeStats = {};
  allUsers.forEach(u => {
    nodeStats[u.id] = {
      selfInvest: walletMap[u.id] || 0,
      networkSales: 0,
      otherLegSales: 0,
      maxLegSales: 0,
      computed: false
    };
  });
  
  const computeNetworkSales = (uid) => {
    if (!nodeStats[uid]) return 0;
    if (nodeStats[uid].computed) return nodeStats[uid].networkSales;
    
    let sales = 0;
    let maxLeg = 0;
    const children = childrenMap[uid] || [];
    for (const childId of children) {
      if (nodeStats[childId]) {
        const childSelf = nodeStats[childId].selfInvest;
        const childNet = computeNetworkSales(childId);
        const childTotal = childSelf + childNet;
        
        sales += childTotal;
        if (childTotal > maxLeg) {
          maxLeg = childTotal;
        }
      }
    }
    
    nodeStats[uid].networkSales = sales;
    nodeStats[uid].maxLegSales = maxLeg;
    nodeStats[uid].otherLegSales = sales - maxLeg;
    nodeStats[uid].computed = true;
    return sales;
  };
  
  allUsers.forEach(u => computeNetworkSales(u.id));
  
  let updatedCount = 0;
  const batch = db.batch();
  let ops = 0;
  
  for (const u of allUsers) {
    const stats = nodeStats[u.id];
    const currentSelf = u.totalInvested || 0;
    const currentNet = u.networkSales || 0;
    const currentOther = u.otherLegSales || 0;
    
    if (currentSelf !== stats.selfInvest || currentNet !== stats.networkSales || currentOther !== stats.otherLegSales) {
      batch.update(db.collection('users').doc(u.id), {
        totalInvested: stats.selfInvest,
        networkSales: stats.networkSales,
        otherLegSales: stats.otherLegSales,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      ops++;
      updatedCount++;
      if (ops === 400) {
        await batch.commit();
        ops = 0;
      }
    }
  }
  
  if (ops > 0) {
    await batch.commit();
  }
  
  console.log(`Updated ${updatedCount} users.`);
  process.exit(0);
}

run().catch(console.error);
