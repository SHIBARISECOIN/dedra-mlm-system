const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function cancelPendingWithdrawals() {
  try {
    const uids = [
      'ulSSEiBR8mhajC9s5Ii1NSbCoij1', // hsy2802
      'mb4hYj4bb8ZWzPs1sAu4zNTf0o02', // hsy7948
      'AXoQBJDewaVL3BslJ437MO5sqtw2'  // hsy3309
    ];

    let totalCancelled = 0;

    for (const uid of uids) {
      console.log(`Checking pending withdrawals for UID: ${uid}...`);
      
      const txRef = db.collection('users').doc(uid).collection('transactions');
      const snapshot = await txRef.where('type', '==', 'withdrawal').where('status', '==', 'pending').get();
      
      if (snapshot.empty) {
        console.log(`  No pending withdrawals found for this user.`);
      } else {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { 
            status: 'rejected',
            adminMemo: '어뷰징(버그 악용) 적발로 인한 출금 거절 및 취소 처리'
          });
          console.log(`  [Cancelled] Transaction ID: ${doc.id}, Amount: ${doc.data().amount} DDRA`);
          totalCancelled++;
        });
        await batch.commit();
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total pending withdrawals cancelled: ${totalCancelled}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cancelPendingWithdrawals();
