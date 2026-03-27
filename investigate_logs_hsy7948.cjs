const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  
  // Check auditLogs involving this user
  const logSnap = await db.collection('auditLogs').where('targetId', '==', uid).get();
  console.log(`\n[Audit Logs for user: ${logSnap.size} found]`);
  logSnap.forEach(d => {
      console.log(d.data());
  });

  // Since transactions query by userId might have failed due to some reason, let's fetch all transactions and filter
  const allTx = await db.collection('transactions').get();
  console.log(`\n[Scanning all ${allTx.size} transactions for this user]`);
  let found = 0;
  allTx.forEach(d => {
      const tx = d.data();
      if (tx.userId === uid || tx.userEmail === 'hsy7948@deedra.com') {
          console.log(` - [${d.id}] Type: ${tx.type} | Amount: ${tx.amountUsdt || tx.amount || 0} | Status: ${tx.status || 'N/A'}`);
          found++;
      }
  });
  if(found === 0) console.log("No transactions found at all for this user.");
}
run().catch(console.error).finally(() => process.exit(0));
