const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function restoreUser() {
  try {
    const email = 'legend@deedra.com';
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      console.log('User not found.');
      process.exit(1);
    }

    const userDoc = snapshot.docs[0];
    const userId = userDoc.id;

    // 1. Update user status to active
    await usersRef.doc(userId).update({ status: 'active' });
    console.log(`User ${email} (${userId}) status updated to 'active'.`);

    // 2. Find pending withdrawal and update to approved
    const txRef = db.collection('users').doc(userId).collection('transactions');
    const txSnapshot = await txRef.where('type', '==', 'withdrawal').where('status', '==', 'pending').get();

    if (txSnapshot.empty) {
      console.log('No pending withdrawal found for this user.');
    } else {
      for (const doc of txSnapshot.docs) {
        await doc.ref.update({ status: 'approved' });
        console.log(`Withdrawal transaction ${doc.id} updated to 'approved'.`);
      }
    }

    // 3. Send notification
    const notifRef = db.collection('users').doc(userId).collection('notifications');
    await notifRef.add({
      title: '계정 정지 해제 안내 / Account Restored',
      message: '초과 지급된 DDRA 반환이 정상적으로 확인되어 계정 일시정지가 해제되었습니다. 기존 출금 대기 건도 승인 처리되었습니다. 이용해 주셔서 감사합니다.',
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: 'system'
    });
    console.log('Notification sent to user.');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

restoreUser();
