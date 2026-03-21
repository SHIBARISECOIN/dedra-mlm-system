const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  const ids = ['zeX6ExUTaPRsSGiixqpf9mHkjRq1', 'wi8OyppKCfSf7RaI8LzA3jNMzhp2'];
  for (let id of ids) {
    const w = await db.collection('wallets').doc(id).get();
    console.log(id, w.data());
    const invs = await db.collection('investments').where('userId', '==', id).get();
    invs.forEach(d => console.log(id, 'investment:', d.data().amount, d.data().status));
  }
  process.exit(0);
}
run();
