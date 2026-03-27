import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function resetAndUnban() {
  const targetEmail = 'hsy7948@gmail.com';
  const targetUsername = 'hsy7948';
  let uid = null;

  // 1. 유저 찾기 (이메일 또는 username)
  const usersRef = db.collection('users');
  const userQuery = await usersRef.where('username', '==', targetUsername).get();
  
  if (userQuery.empty) {
      const emailQuery = await usersRef.where('email', '==', targetEmail).get();
      if (!emailQuery.empty) {
          uid = emailQuery.docs[0].id;
      }
  } else {
      uid = userQuery.docs[0].id;
  }

  // 앞서 발견한 문서 ID 직접 사용 (위 검색이 안될경우를 대비한 하드코딩 백업)
  if (!uid) {
      uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02';
  }

  console.log(`Target User ID: ${uid}`);

  const batch = db.batch();

  // 2. 계정 정지 해제
  const userDocRef = db.collection('users').doc(uid);
  batch.update(userDocRef, {
      status: 'active',
      suspendReason: FieldValue.delete(),
      suspendedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
  });
  console.log('-> User status marked as active');

  // 3. 지갑 잔고 올 0 초기화
  const walletQuery = await db.collection('wallets').where('userId', '==', uid).get();
  if (!walletQuery.empty) {
      const walletRef = walletQuery.docs[0].ref;
      batch.update(walletRef, {
          usdtBalance: 0,
          dedraBalance: 0,
          bonusBalance: 0,
          totalDeposit: 0,
          totalWithdrawal: 0,
          totalInvest: 0,
          totalEarnings: 0,
          updatedAt: FieldValue.serverTimestamp()
      });
      console.log('-> Wallet balances fully reset to 0');
  }

  // 4. 진행 중인 투자(FREEZE) 상품 모두 강제 만료/취소 처리 (회수)
  const investQuery = await db.collection('investments')
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .get();

  let investCount = 0;
  investQuery.forEach(doc => {
      batch.update(doc.ref, {
          status: 'confiscated', // 압수됨/회수됨 상태로 변경 (정산돌지 않게)
          confiscatedAt: FieldValue.serverTimestamp(),
          memo: '버그 악용으로 인한 투자금 전액 관리자 강제 회수'
      });
      investCount++;
  });
  console.log(`-> ${investCount} active investments confiscated (frozen)`);

  // 5. 실행
  await batch.commit();
  console.log('✅ Account reset, investments confiscated, and unbanned successfully!');
}

resetAndUnban().then(() => process.exit(0)).catch(console.error);
