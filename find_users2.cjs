const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function findUsers() {
  const snap = await db.collection('users').get();
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const hsy = users.filter(u => 
    (u.name && u.name.toLowerCase().includes('hsy7948')) || 
    (u.email && u.email.toLowerCase().includes('hsy7948')) ||
    (u.username && u.username.toLowerCase().includes('hsy7948'))
  );
  
  console.log('--- HSY7948 ---');
  hsy.forEach(u => console.log(u.id, u.name, u.email, u.username, u.status, u.suspendReason));

  const cyj = users.filter(u => 
    (u.name && u.name.toLowerCase().includes('cyj0300')) || 
    (u.email && u.email.toLowerCase().includes('cyj0300')) ||
    (u.username && u.username.toLowerCase().includes('cyj0300'))
  );

  console.log('--- CYJ0300 ---');
  cyj.forEach(u => console.log(u.id, u.name, u.email, u.username, u.status));
}
findUsers().catch(console.error);
