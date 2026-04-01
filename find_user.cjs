const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  let found = false;
  let targetUid = null;
  snapshot.forEach(doc => {
    const data = doc.data();
    if ((data.email && data.email.includes('me0909')) || 
        (data.loginId && data.loginId.includes('me0909')) ||
        (data.name && data.name.includes('me0909'))) {
      console.log('Found user:', doc.id, 'Email:', data.email, 'Name:', data.name, 'SuspendWithdrawal:', data.suspendWithdrawal, 'Status:', data.status);
      found = true;
      targetUid = doc.id;
    }
  });
  
  if (targetUid) {
      await db.collection('users').doc(targetUid).update({
          suspendWithdrawal: false,
          status: 'active'
      });
      console.log('Successfully enabled withdrawal for me0909');
  }
  
  if (!found) console.log('User me0909 not found');
}
run().catch(console.error);
