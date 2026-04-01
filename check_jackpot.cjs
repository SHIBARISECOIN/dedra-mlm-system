const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkJackpot() {
    // KST 기준으로 오늘의 시작 시간 계산
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    
    // 오늘 자정 (KST)
    const startOfDayKST = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate(), 0, 0, 0);
    const startOfDayUTC = new Date(startOfDayKST.getTime() - kstOffset);

    console.log(`Checking withdrawals since: ${startOfDayUTC.toISOString()} (UTC) / ${startOfDayKST.toISOString()} (KST)`);

    const txSnapshot = await db.collection('transactions')
        .where('type', '==', 'withdrawal')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfDayUTC))
        .get();

    let totalWithdrawalUsdt = 0;
    let totalFeeUsdt = 0;
    let count = 0;
    let txDetails = [];

    txSnapshot.forEach(doc => {
        const data = doc.data();
        const amountUsdt = data.amountUsdt || 0;
        const feeRate = data.feeRate || 0;
        const feeUsdt = amountUsdt * (feeRate / 100);
        
        totalWithdrawalUsdt += amountUsdt;
        totalFeeUsdt += feeUsdt;
        count++;
        
        txDetails.push({
            id: doc.id,
            userId: data.userId,
            amountUsdt: amountUsdt,
            feeRate: feeRate,
            feeUsdt: feeUsdt,
            status: data.status,
            time: data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'
        });
    });

    const jpDoc = await db.collection('events').doc('weekly_jackpot').get();
    const jpData = jpDoc.exists ? jpDoc.data() : { amount: 0 };

    console.log("\n=== 오늘 출금 수수료 및 잭팟 누적액 확인 ===");
    console.log(`오늘 출금 건수: ${count}건`);
    console.log(`오늘 총 출금 신청액 (USDT): $${totalWithdrawalUsdt.toFixed(2)}`);
    console.log(`오늘 총 발생 수수료 (USDT): $${totalFeeUsdt.toFixed(2)}`);
    console.log(`-----------------------------------`);
    console.log(`현재 주간 잭팟 누적액 (USDT): $${(jpData.amount || 0).toFixed(2)}`);
    
    if (count > 0) {
        console.log("\n[오늘의 출금 상세 내역]");
        console.table(txDetails);
    }
    
    process.exit(0);
}

checkJackpot().catch(err => {
    console.error(err);
    process.exit(1);
});
