import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixAccount() {
  const uid = 'mb4hYj4bb8ZWzPs1sAu4zNTf0o02'; // hsy7948
  
  // 1. Suspend User
  await db.collection('users').doc(uid).update({
      status: 'suspended',
      suspendReason: '게임(바카라 타이) 버그 악용 및 부당 이득 취득'
  });
  console.log("User status updated to 'suspended'.");
  
  // 2. Zero out Wallet
  const wallets = await db.collection('wallets').where('userId', '==', uid).get();
  for (const doc of wallets.docs) {
      await doc.ref.update({
          usdtBalance: 0,
          dedraBalance: 0,
          bonusBalance: 0,
          totalInvest: 0, // 운용중 잔액 0으로 초기화
          totalInvested: 0
      });
      console.log(`Wallet ${doc.id} balances zeroed out.`);
  }
  
  // 3. Cancel Active Investments
  const investments = await db.collection('investments').where('userId', '==', uid).where('status', '==', 'active').get();
  for (const doc of investments.docs) {
      await doc.ref.update({
          status: 'cancelled',
          cancelReason: '어뷰징 적발로 인한 강제 회수 조치'
      });
      console.log(`Investment ${doc.id} cancelled.`);
  }
}

fixAccount().then(() => process.exit(0)).catch(console.error);
