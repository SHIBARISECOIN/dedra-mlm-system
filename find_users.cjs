const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function findUsers() {
  const usersRef = db.collection('users');
  
  // Search for HSY7948
  const q1 = await usersRef.where('name', '>=', 'HSY7948').where('name', '<=', 'HSY7948\uf8ff').get();
  console.log('--- HSY7948 ---');
  if (q1.empty) {
    const q1_alt = await usersRef.where('email', '>=', 'HSY7948').where('email', '<=', 'HSY7948\uf8ff').get();
    q1_alt.forEach(d => console.log(d.id, d.data().name, d.data().email, d.data().status, d.data().suspendReason));
  } else {
    q1.forEach(d => console.log(d.id, d.data().name, d.data().email, d.data().status, d.data().suspendReason));
  }

  // Search for CYJ0300
  const q2 = await usersRef.where('email', '>=', 'CYJ0300').where('email', '<=', 'CYJ0300\uf8ff').get();
  console.log('--- CYJ0300 ---');
  if (q2.empty) {
    const q2_alt = await usersRef.where('name', '>=', 'CYJ0300').where('name', '<=', 'CYJ0300\uf8ff').get();
    q2_alt.forEach(d => console.log(d.id, d.data().name, d.data().email, d.data().status));
  } else {
    q2.forEach(d => console.log(d.id, d.data().name, d.data().email, d.data().status));
  }
}
findUsers().catch(console.error);
