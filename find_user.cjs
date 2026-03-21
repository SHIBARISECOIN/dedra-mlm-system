const admin = require('firebase-admin');
const fs = require('fs');

const content = fs.readFileSync('/home/user/webapp/check_true_downlines.cjs', 'utf-8');
const match = content.match(/const SERVICE_ACCOUNT = ({[\s\S]*?});/);
const SERVICE_ACCOUNT = eval('(' + match[1] + ')');

if (!admin.apps.length) { 
    admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) }); 
}
const db = admin.firestore();

async function run() {
    const uid = 'Fwuwmh5zdxYIz3HQX1bwihG9vc13';
    const docRef = await db.collection('users').doc(uid).get();
    
    if (docRef.exists) {
        const data = docRef.data();
        console.log(`=== 회원 정보 ===`);
        console.log(`이름: ${data.name}`);
        console.log(`이메일: ${data.email}`);
        console.log(`직급: ${data.rank || '없음'}`);
        console.log(`추천인 UID: ${data.referredBy || '없음'}`);
        console.log(`가입일: ${data.createdAt ? new Date(data.createdAt._seconds * 1000).toLocaleString('ko-KR') : '알 수 없음'}`);
        
        // 지갑 잔액도 같이 볼까요?
        const walletRef = await db.collection('wallets').doc(uid).get();
        if(walletRef.exists) {
            const wData = walletRef.data();
            console.log(`총 투자금: $${wData.totalInvested || wData.totalInvest || 0}`);
        }
    } else {
        console.log(`UID가 '${uid}'인 회원을 찾을 수 없습니다.`);
    }
}

run().catch(console.error);
