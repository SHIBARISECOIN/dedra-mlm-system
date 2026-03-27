const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const invId = 'migrated_Nlq4CBNYjuPwX5wJBocmQGY6xht1_v3_1773848929898';
  
  // Find bonuses linked to this investment
  const bSnap = await db.collection('bonuses')
    .where('userId', '==', 'Nlq4CBNYjuPwX5wJBocmQGY6xht1')
    .get();
    
  console.log(`Found ${bSnap.size} bonuses for this user`);
  let hasReinvest = false;
  bSnap.forEach(d => {
    const data = d.data();
    if (data.type === 'roi') {
      console.log(`- Date: ${data.settlementDate}, Type: ${data.type}, Amount: ${data.amountUsdt}`);
    }
  });
}

run().catch(console.error).finally(() => process.exit(0));
