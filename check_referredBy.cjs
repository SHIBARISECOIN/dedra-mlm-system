const admin = require('firebase-admin');
const serviceAccount = require('./deedra-b873f-firebase-adminsdk-p1f2a-d9b8e217cc.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function check() {
  const usersSnap = await db.collection('users').get();
  const validUids = new Set();
  const usernames = new Map();
  usersSnap.forEach(d => {
    validUids.add(d.id);
    usernames.set(d.data().username || d.data().referralCode, d.id);
  });
  
  let invalid = 0;
  let matchesUsername = 0;
  usersSnap.forEach(d => {
    const data = d.data();
    if (data.referredBy && !validUids.has(data.referredBy)) {
      console.log(`User ${d.id} (${data.username}) has invalid referredBy: ${data.referredBy}`);
      invalid++;
      if (usernames.has(data.referredBy)) {
          matchesUsername++;
          console.log(`  -> But it matches username for UID: ${usernames.get(data.referredBy)}`);
      }
    }
  });
  console.log(`Total invalid referredBy: ${invalid} (Matches username: ${matchesUsername})`);
  process.exit(0);
}
check();
