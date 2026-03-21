const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const usersSnap = await db.collection('users').get();
  const walletsSnap = await db.collection('wallets').get();
  
  const users = [];
  usersSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
  
  const walletMap = {};
  walletsSnap.forEach(d => {
    const data = d.data();
    walletMap[d.id] = data.totalInvested || data.totalInvest || 0;
  });
  
  const childrenMap = {};
  const userMap = {};
  
  users.forEach(u => {
    childrenMap[u.id] = [];
    userMap[u.id] = u;
  });
  
  users.forEach(u => {
    if (u.referredBy && childrenMap[u.referredBy]) {
      childrenMap[u.referredBy].push(u.id);
    }
  });
  
  const nodeStats = {};
  users.forEach(u => {
    nodeStats[u.id] = {
      selfInvest: walletMap[u.id] || 0,
      networkSales: 0,
      computed: false
    };
  });
  
  const computeNetworkSales = (uid) => {
    if (!nodeStats[uid]) return 0;
    if (nodeStats[uid].computed) return nodeStats[uid].networkSales;
    
    let sales = 0;
    const children = childrenMap[uid] || [];
    for (const childId of children) {
      if (nodeStats[childId]) {
        sales += nodeStats[childId].selfInvest;
        sales += computeNetworkSales(childId);
      }
    }
    
    nodeStats[uid].networkSales = sales;
    nodeStats[uid].computed = true;
    return sales;
  };
  
  users.forEach(u => computeNetworkSales(u.id));
  
  let updatedCount = 0;
  
  const batchSize = 500;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = db.batch();
    const chunk = users.slice(i, i + batchSize);
    let count = 0;
    
    for (const u of chunk) {
      const stats = nodeStats[u.id];
      if (!stats) continue;
      
      const currentSelf = u.totalInvested || 0;
      const currentNet = u.networkSales || 0;
      
      if (currentSelf !== stats.selfInvest || currentNet !== stats.networkSales) {
        batch.update(db.collection('users').doc(u.id), {
          totalInvested: stats.selfInvest,
          networkSales: stats.networkSales,
          updatedAt: new Date().toISOString()
        });
        count++;
        updatedCount++;
      }
    }
    if (count > 0) {
      await batch.commit();
      console.log(`Committed ${count} updates`);
    }
  }
  
  console.log(`Total users updated: ${updatedCount}`);
}

run().then(() => process.exit(0)).catch(console.error);
