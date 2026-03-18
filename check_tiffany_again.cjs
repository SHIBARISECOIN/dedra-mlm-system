const admin = require('firebase-admin');
const fs = require('fs');
const saContent = fs.readFileSync('/home/user/webapp/sa.js', 'utf8').replace('const SERVICE_ACCOUNT = ', '').replace(/};\s*$/, '}');
const SERVICE_ACCOUNT = eval('(' + saContent + ')');
admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
const db = admin.firestore();

async function run() {
  const uid = 'rlSK0MotrUT1AbEXlSAmolfKpZ42'; // tiffany01
  const invs = await db.collection('investments').where('userId', '==', uid).get();
  invs.forEach(d => {
    const data = d.data();
    console.log(`Inv: amt=${data.amount}, earned=${data.earned || 0}, created=${data.createdAt?.toDate()}`);
  });
  
  const w = await db.collection('wallets').doc(uid).get();
  console.log("Wallet:", w.data().bonusBalance, w.data().totalEarnings);
}
run().catch(console.error);
