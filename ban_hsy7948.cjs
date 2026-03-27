const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function banAndConfiscate() {
  try {
    const email = 'hsy7948@deedra.com';
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      console.log(`User ${email} not found.`);
      process.exit(1);
    }

    const userDoc = snapshot.docs[0];
    const uid = userDoc.id;

    // 1. Suspend User
    await usersRef.doc(uid).update({ status: 'suspended' });
    console.log(`[Success] User ${email} (UID: ${uid}) status updated to 'suspended'.`);

    // 2. Confiscate Balance (Set bonusBalance to 0)
    const walletRef = db.collection('wallets').doc(uid);
    const walletDoc = await walletRef.get();
    let confiscatedAmount = 0;
    
    if (walletDoc.exists) {
      confiscatedAmount = walletDoc.data().bonusBalance || 0;
      await walletRef.update({ bonusBalance: 0 });
      console.log(`[Success] Confiscated ${confiscatedAmount} DDRA from bonusBalance. Balance is now 0.`);
    }

    // 3. Send Notification
    const notifMsg = `[안내] 시스템 오류 악용(어뷰징)에 따른 계정 영구 정지 및 부당 이득 환수 통보\n\n` +
      `당사 보안 및 모니터링 시스템 감식 결과, 해당 계정에서 정상적인 서비스 이용이 아닌 시스템의 특정 확률 오류(맹점)를 고의적으로 악용한 심각한 어뷰징(Abusing) 행위 및 다계정 생성 패턴이 적발되었습니다.\n\n` +
      `- 비정상적인 게임 패턴: 매크로 등을 이용해 확률이 잘못 적용된 게임에만 집중적으로 배팅 (총 3,144회 플레이)\n` +
      `- 약관 위반: 시스템의 취약점 및 버그를 고의적으로 악용, 악성 다계정 생성을 통해 부당한 이득을 취하는 행위\n\n` +
      `이에 따라 당사는 서비스와 다른 선량한 유저들을 보호하기 위해 약관에 의거하여 다음과 같은 조치를 시행하였습니다.\n` +
      `1. 계정 영구 정지 (접근 및 출금 차단)\n` +
      `2. 버그 악용으로 생성된 부당 수익금 전액 환수 조치`;

    const notifRef = db.collection('users').doc(uid).collection('notifications');
    await notifRef.add({
      title: '계정 영구 정지 및 잔액 환수 안내',
      message: notifMsg,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      type: 'system'
    });
    console.log(`[Success] Notification sent to user.`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

banAndConfiscate();
