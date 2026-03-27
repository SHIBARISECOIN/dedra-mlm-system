const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function check() {
  const w = await db.collection('wallets').doc('Nlq4CBNYjuPwX5wJBocmQGY6xht1').get();
  console.log(w.data());
  const u = await db.collection('users').doc('Nlq4CBNYjuPwX5wJBocmQGY6xht1').get();
  console.log('autoCompound:', u.data().autoCompound);
}
check().catch(console.error).finally(() => process.exit(0));
