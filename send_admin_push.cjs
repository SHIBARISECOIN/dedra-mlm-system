const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('/home/user/webapp/service-account.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function run() {
    const uid = "mb4hYj4bb8ZWzPs1sAu4zNTf0o02";
    
    // Create notification matching admin's structure
    const notifData = {
        userId: uid,
        title: "🔔 [안내] 게임 내역 및 잔액 변동 관련 안내",
        message: "고객님, 데이터베이스의 모든 게임 로그(총 521회)를 정밀 분석한 결과, 시스템 오류나 코인 소실은 없었습니다.\n\n고객님께서 주사위/홀짝 게임을 플레이하실 때 사용되는 DDRA 코인은 고객님의 실제 '보너스 잔액(USDT)'과 연동되어 있습니다.\n\n승리하신 판도 155번 있었지만, 패배하신 판이 366번으로 더 많아 결과적으로 총 1,218 DDRA(약 45.41 USDT 상당)의 게임 손실이 발생하여 보유 중이던 보너스 잔액에서 정상 차감된 상태입니다.",
        originalTitle: "🔔 [안내] 게임 내역 및 잔액 변동 관련 안내",
        originalMessage: "고객님, 데이터베이스의 모든 게임 로그(총 521회)를 정밀 분석한 결과, 시스템 오류나 코인 소실은 없었습니다.\n\n고객님께서 주사위/홀짝 게임을 플레이하실 때 사용되는 DDRA 코인은 고객님의 실제 '보너스 잔액(USDT)'과 연동되어 있습니다.\n\n승리하신 판도 155번 있었지만, 패배하신 판이 366번으로 더 많아 결과적으로 총 1,218 DDRA(약 45.41 USDT 상당)의 게임 손실이 발생하여 보유 중이던 보너스 잔액에서 정상 차감된 상태입니다.",
        lang: "ko",
        type: "system",
        icon: "📢",
        color: "#6366f1",
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const ref = await db.collection('notifications').add(notifData);
        console.log("Success with ID:", ref.id);
        
        // Let's also check all notifications to see if they are read or not.
        const snap = await db.collection('notifications').where('userId', '==', uid).get();
        console.log("Total notifs for user:", snap.size);
    } catch (e) {
        console.error(e);
    }
}
run();
