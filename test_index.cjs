const admin = require('firebase-admin');
const fs = require('fs');

const saContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const clientEmail = saContent.match(/client_email:\s*"([^"]+)"/)[1];
const privateKey = saContent.match(/private_key:\s*"([^"]+)"/)[1].replace(/\\n/g, '\n');
const projectId = saContent.match(/project_id:\s*"([^"]+)"/)[1];

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}
const db = admin.firestore();

async function check() {
  try {
    const invQ = db.collection("investments").where("userId", "in", ["test1", "test2"]).where("status", "==", "active");
    await invQ.get();
    console.log("Investments query succeeded");
  } catch(e) {
    console.log("Investments query failed:", e.message);
  }
  process.exit(0);

  const usersSnapshot = await db.collection('users').where('username', '==', 'cyj0300').get();
  if (usersSnapshot.empty) {
    console.log("User cyj0300 not found");
    return;
  }
  const user = usersSnapshot.docs[0].data();
  console.log("User ID:", user.uid);
  
  const walletSnapshot = await db.collection('wallets').doc(user.uid).get();
  console.log("Wallet:", walletSnapshot.data());
  
  const bonusesSnap = await db.collection('bonuses').where('userId', '==', user.uid).get();
  console.log(`Bonuses count for ${user.username}:`, bonusesSnap.size);
  bonusesSnap.docs.forEach(d => {
    const data = d.data();
    let dateStr = "Unknown";
    if (data.createdAt && typeof data.createdAt.toDate === 'function') dateStr = data.createdAt.toDate().toISOString();
    else if (data.createdAt) dateStr = String(data.createdAt);
    console.log(`- ${data.type}: ${data.amount} (from: ${data.fromUserId || 'sys'}, date: ${dateStr})`);
  });

  // Let's also check who they referred
  const refsSnap = await db.collection('users').where('referredBy', '==', user.uid).get();
  console.log(`Referred users count:`, refsSnap.size);
  refsSnap.docs.forEach(d => console.log(` - ${d.data().username}`));

}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
