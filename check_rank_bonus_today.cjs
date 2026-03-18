const admin = require('firebase-admin');
const fs = require('fs');
const idxContent = fs.readFileSync('/home/user/webapp/src/index.tsx', 'utf8');
const cEm = idxContent.match(/client_email:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_CLIENT_EMAIL\s*=\s*['"](.*?)['"]/)?.[1];
const pK = (idxContent.match(/private_key:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PRIVATE_KEY\s*=\s*['"](.*?)['"]/)?.[1]).replace(/\\n/g, '\n');
const pId = idxContent.match(/project_id:\s*"([^"]+)"/)?.[1] || idxContent.match(/FIREBASE_PROJECT_ID\s*=\s*['"](.*?)['"]/)?.[1];
admin.initializeApp({ credential: admin.credential.cert({ projectId: pId, clientEmail: cEm, privateKey: pK }) });
const db = admin.firestore();
async function run() {
  const usersSnap = await db.collection('users').where('username', '==', 'cyj0300').get();
  const uid = usersSnap.docs[0].id;
  const bSnap = await db.collection('bonuses')
      .where('userId', '==', uid)
      .where('type', 'in', ['rank_bonus', 'rank_gap_passthru', 'rank_equal_or_higher_override_1pct', 'rank_equal_or_higher_override'])
      .get();
  
  const byDate = {};
  bSnap.docs.forEach(d => {
    const data = d.data();
    const dt = data.settlementDate || (data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString().slice(0,10) : 'none');
    byDate[dt] = (byDate[dt] || 0) + (data.amountUsdt || data.amount);
  });
  console.log("Rank bonuses by date:", byDate);
}
run().then(() => process.exit(0));
