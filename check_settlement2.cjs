const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  // get bonuses without sorting or complex filters to avoid index requirements
  // just get all recent bonuses from memory
  const bonusesRef = await db.collection('bonuses').get();
  
  let totalRoiCount = 0;
  let totalRoiAmount = 0;
  
  let types = {};
  let recentItems = [];

  bonusesRef.forEach(doc => {
    const d = doc.data();
    
    // Check if it's recent (last 24 hours)
    let isRecent = false;
    if (d.createdAt) {
      try {
        const dDate = new Date(d.createdAt);
        if (dDate > yesterday) isRecent = true;
      } catch(e) {}
    }
    
    if (isRecent) {
      if (!types[d.type]) types[d.type] = { count: 0, amount: 0 };
      types[d.type].count++;
      types[d.type].amount += (d.amountUsdt || d.amount || 0);
      
      if (d.type === 'daily_roi' || d.type === 'roi') {
        recentItems.push({ id: doc.id, userId: d.userId, amount: d.amount, date: d.createdAt });
      }
    }
  });
  
  console.log("=== Last 24 Hours Bonus Summary ===");
  for (const [t, data] of Object.entries(types)) {
    console.log(`Type: ${t}, Count: ${data.count}, Amount: ${data.amount}`);
  }
  
  console.log(`\nSample of recent ROIs (first 5):`);
  console.log(recentItems.slice(0, 5));
}
run();
