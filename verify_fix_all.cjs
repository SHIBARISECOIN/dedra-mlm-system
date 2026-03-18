const admin = require('firebase-admin');
const fs = require('fs');

const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const cEm = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/)?.[1];
const pK = (idxContent.match(/private_key:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/)?.[1]).replace(/\\n/g, '\n');
const pId = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/)?.[1];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
}
const db = admin.firestore();

async function run() {
  const usersSnap = await db.collection('users').where('username', 'in', ['cyj0300', 'big001', 'idok333']).get();
  for (const uDoc of usersSnap.docs) {
    const u = uDoc.data();
    console.log(`[${u.username}] UID: ${uDoc.id}`);
    
    const invSnap = await db.collection('investments').where('userId', '==', uDoc.id).where('status', '==', 'active').get();
    invSnap.docs.forEach(i => console.log(`  - Inv: ${i.data().amount} USDT, ROI: ${i.data().dailyRoi}%, Start: ${i.data().startDate}`));
    
    const walletSnap = await db.collection('wallets').doc(uDoc.id).get();
    if(walletSnap.exists) {
      console.log(`  - Wallet: Bonus=${walletSnap.data().bonusBalance}, Earnings=${walletSnap.data().totalEarnings}`);
    }
  }
}
run().then(() => process.exit(0)).catch(console.error);
