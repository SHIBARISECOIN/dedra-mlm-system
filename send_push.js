import { readFileSync } from 'fs';
import { google } from 'googleapis';

const projectId = "dedra-mlm";

async function getAccessToken() {
    const keyFile = readFileSync('/home/user/webapp/service-account.json', 'utf8');
    const credentials = JSON.parse(keyFile);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/datastore']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

async function run() {
    try {
        const token = await getAccessToken();
        const uid = "mb4hYj4bb8ZWzPs1sAu4zNTf0o02";
        
        const title = "🔔 [안내] 게임 내역 및 잔액 변동 관련 안내";
        const message = "고객님, 데이터베이스의 모든 게임 로그(총 521회)를 정밀 분석한 결과, 시스템 오류나 코인 소실은 없었습니다.\n\n고객님께서 주사위/홀짝 게임을 플레이하실 때 사용되는 DDRA 코인은 고객님의 실제 '보너스 잔액(USDT)'과 연동되어 있습니다.\n\n승리하신 판도 155번 있었지만, 패배하신 판이 366번으로 더 많아 결과적으로 총 1,218 DDRA(약 45.41 USDT 상당)의 게임 손실이 발생하여 보유 중이던 보너스 잔액에서 정상 차감된 상태입니다.";

        const notifDoc = {
            fields: {
                userId: { stringValue: uid },
                type: { stringValue: 'system' },
                title: { stringValue: title },
                message: { stringValue: message },
                isRead: { booleanValue: false },
                createdAt: { timestampValue: new Date().toISOString() }
            }
        };
        
        const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(notifDoc)
        });
        
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
        if (data.name) {
            console.log("Successfully sent push notification to user.");
        }
        
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
