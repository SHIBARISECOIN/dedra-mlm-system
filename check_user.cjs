const admin = require('/home/user/webapp/node_modules/firebase-admin');
const serviceAccount = require('/home/user/webapp/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
async function run() {
  const db = admin.firestore();
  const snap = await db.collection('users').limit(5).get();
  snap.forEach(doc => {
     console.log("User:", doc.id);
     console.log("Data:", doc.data());
  });
}
run();
