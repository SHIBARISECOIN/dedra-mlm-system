const admin = require("firebase-admin");

// Initialize from default environment credentials or service account
try {
  const serviceAccount = require("../deedra-mlm-firebase-adminsdk-xxxxx.json"); // Provide correct name if you know it, otherwise use application default
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  // Fallback to searching for the key
  const fs = require('fs');
  const path = require('path');
  const files = fs.readdirSync('/home/user/webapp');
  const keyFile = files.find(f => f.includes('firebase') && f.endsWith('.json'));
  
  if (keyFile) {
    const serviceAccount = require(path.join('/home/user/webapp', keyFile));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // If no specific file found, try application default (requires env var GOOGLE_APPLICATION_CREDENTIALS)
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function run() {
  console.log("Fetching all rank bonuses to see the scale of the rollback...");
  const snapshot = await db.collection("bonuses")
    .where("type", "in", ["rank_bonus", "rank_equal_or_higher_override_1pct"])
    .get();
  
  let totalAmount = 0;
  const userTotals = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const amt = Number(data.amount || 0);
    totalAmount += amt;
    
    if (!userTotals[data.userId]) {
      userTotals[data.userId] = { count: 0, amount: 0 };
    }
    userTotals[data.userId].count++;
    userTotals[data.userId].amount += amt;
  });
  
  console.log(`Total records found: ${snapshot.size}`);
  console.log(`Total USD overpaid: $${totalAmount.toFixed(2)}`);
  console.log(`Number of affected users: ${Object.keys(userTotals).length}`);
  
  // Sort users by amount
  const sorted = Object.entries(userTotals)
    .map(([uid, stats]) => ({uid, ...stats}))
    .sort((a, b) => b.amount - a.amount);
    
  console.log("\nTop 10 affected users:");
  sorted.slice(0, 10).forEach(u => {
    console.log(`- ${u.uid}: $${u.amount.toFixed(2)} (${u.count} records)`);
  });
}

run().catch(console.error).finally(() => process.exit(0));
