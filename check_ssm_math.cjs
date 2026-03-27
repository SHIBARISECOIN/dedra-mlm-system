const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const parent = await db.collection('users').where('username', '==', 'ssm9310').get();
  if(parent.empty) {
      console.log("ssm9310 not found");
      return;
  }
  let parentData = parent.docs[0].data();

  console.log(`ssm9310 현재 DB값 - 본인투자: ${parentData.totalInvested}, 산하매출(networkSales): ${parentData.networkSales}`);

  const childrenUsernames = ['kcy9313', 'pdh8949', 'csr5543'];
  let calcSum = 0;
  for (const un of childrenUsernames) {
    const snap = await db.collection('users').where('username', '==', un).get();
    if(!snap.empty) {
      const d = snap.docs[0].data();
      const childTotal = (d.totalInvested || 0) + (d.networkSales || 0);
      calcSum += childTotal;
      console.log(`${un} 현재 DB값 - 본인투자: ${d.totalInvested || 0}, 산하매출(networkSales): ${d.networkSales || 0} => 상위(ssm9310) 기여분: ${childTotal}`);
    }
  }
  console.log(`--------------------------------------------------`);
  console.log(`직대 하위 3명의 기여분 합계 (이론상 전체 합계): ${calcSum} USDT`);
}
check().catch(console.error).finally(() => process.exit(0));
