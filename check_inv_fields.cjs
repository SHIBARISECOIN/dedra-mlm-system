const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function check() {
  const doc = await db.collection('investments').doc('migrated_Nlq4CBNYjuPwX5wJBocmQGY6xht1_v3_1773848929898').get();
  console.log(doc.data());
}
check().catch(console.error).finally(() => process.exit(0));
