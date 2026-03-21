const admin = require("firebase-admin");
if (!admin.apps.length) {
  const serviceAccount = require("./serviceAccountKey.json"); // Assuming this exists from previous steps
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const uid = "qAdGKU772oVGZ0B5PwUEbL3UqSF3";
  
  // 1. Check wallet again deeply
  const walletDoc = await db.collection("wallets").doc(uid).get();
  console.log("--- WALLET ---");
  console.log(walletDoc.data());

  // 2. Check P2P transfers (where cyj0300 is receiver)
  const transfersRef = await db.collection("transfers").where("receiverId", "==", uid).get();
  let transferSum = 0;
  console.log(`\n--- TRANSFERS RECEIVED --- (${transfersRef.size} found)`);
  transfersRef.forEach(doc => {
    const d = doc.data();
    console.log(`Transfer: ${d.amount} from ${d.senderEmail || d.senderId} on ${d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt}`);
    transferSum += Number(d.amount || 0);
  });

  // 3. Check for any other manual transactions/deposits
  const txRef = await db.collection("transactions").where("userId", "==", uid).get();
  let txSum = 0;
  console.log(`\n--- TRANSACTIONS --- (${txRef.size} found)`);
  txRef.forEach(doc => {
    const d = doc.data();
    console.log(`Tx: ${d.type} | ${d.amount} | ${d.reason} | ${d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt}`);
    if (d.type === 'manual_add' || d.type === 'deposit') {
       txSum += Number(d.amount || 0);
    }
  });
  
  console.log("\nSummary of extra balance:");
  console.log("Transfers received:", transferSum);
  console.log("Manual/Deposit Txs:", txSum);
}

check().catch(console.error).finally(() => process.exit(0));
