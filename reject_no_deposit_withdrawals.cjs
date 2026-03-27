const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
  console.log("Fetching pending/held withdrawals...");
  const txSnap = await db.collection('transactions')
    .where('type', '==', 'withdrawal')
    .where('status', 'in', ['pending', 'held'])
    .get();

  console.log(`Found ${txSnap.size} unresolved withdrawal requests.`);

  let rejectedCount = 0;
  let skippedCount = 0;
  
  for (const doc of txSnap.docs) {
    const tx = doc.data();
    const uid = tx.userId;
    const txId = doc.id;
    const usdtAmt = tx.amountUsdt || tx.amount || 0;

    // Get user wallet
    const wSnap = await db.collection('wallets').doc(uid).get();
    let totalDeposit = 0;
    let walletRef = null;

    if (wSnap.exists) {
        totalDeposit = wSnap.data().totalDeposit || 0;
        walletRef = wSnap.ref;
    } else {
        const wq = await db.collection('wallets').where('userId', '==', uid).get();
        if (!wq.empty) {
            totalDeposit = wq.docs[0].data().totalDeposit || 0;
            walletRef = wq.docs[0].ref;
        }
    }

    if (totalDeposit <= 0 && walletRef) {
        console.log(`[REJECT] User ${tx.userEmail || uid} (totalDeposit: ${totalDeposit}) requested ${usdtAmt} USDT. Tx: ${txId}`);
        const batch = db.batch();
        
        // 1. Delete transaction (as admin UI does)
        batch.delete(doc.ref);

        // 2. Refund balance
        batch.update(walletRef, {
            bonusBalance: admin.firestore.FieldValue.increment(usdtAmt),
            totalWithdrawal: admin.firestore.FieldValue.increment(-usdtAmt)
        });

        // 3. Create notification
        const notiRef = db.collection('notifications').doc();
        batch.set(notiRef, {
            userId: uid,
            title: '출금 거부 알림',
            body: '현재 입금내역이 확인되지 않아 출금신청이 거부되었습니다.',
            type: 'withdrawal',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 4. Audit Log
        const auditRef = db.collection('auditLogs').doc();
        batch.set(auditRef, {
            adminId: 'system_auto',
            adminEmail: 'system_auto',
            action: 'withdrawal',
            details: '입금 이력 없음 (어뷰징 방지)으로 일괄 거부 처리',
            targetId: txId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        rejectedCount++;
    } else {
        console.log(`[SKIP] User ${tx.userEmail || uid} has totalDeposit: ${totalDeposit}. Skipping tx: ${txId}`);
        skippedCount++;
    }
  }

  console.log(`\nDONE. Rejected: ${rejectedCount}, Skipped: ${skippedCount}`);
}

run().catch(console.error).finally(() => process.exit(0));
