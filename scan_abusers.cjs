const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function scanAbusers() {
  try {
    console.log('Scanning all users for suspicious patterns...\n');
    const usersSnap = await db.collection('users').get();
    const suspicious = [];
    
    // Batch fetch wallets for efficiency
    const walletsSnap = await db.collection('wallets').get();
    const walletsMap = {};
    walletsSnap.forEach(doc => {
      walletsMap[doc.id] = doc.data();
    });

    usersSnap.forEach(doc => {
      const user = doc.data();
      const uid = doc.id;
      const email = user.email || '';
      
      // 이미 정지된 계정 제외
      if (user.status === 'suspended') return;
      // 관리자 등 특정 이메일 제외 (필요시)
      if (email.includes('admin')) return;

      const wallet = walletsMap[uid];
      if (!wallet) return;
      
      const invested = wallet.totalInvested || 0;
      const bonus = wallet.bonusBalance || 0;
      
      let flags = [];
      
      // 1. Email Pattern
      if (/^hsy\d+@/.test(email)) {
        flags.push('Pattern: hsy+num');
      }
      
      // 2. High ROI (투자금 대비 10배 이상 잔액, 잔액이 최소 500 이상일때만)
      if (invested > 0 && bonus > invested * 10 && bonus > 500) {
        flags.push(`High ROI (${(bonus/invested).toFixed(1)}x)`);
      }
      
      // 3. No investment but high bonus
      if (invested === 0 && bonus > 500) {
        flags.push(`Zero Invest, High Bal`);
      }

      if (flags.length > 0) {
        suspicious.push({
          Email: email,
          Invested: invested,
          BonusBalance: Math.floor(bonus),
          Flags: flags.join(' | '),
          Created: user.createdAt ? user.createdAt.toDate().toISOString().split('T')[0] : 'N/A'
        });
      }
    });

    // 정렬: 잔액이 많은 순
    suspicious.sort((a, b) => b.BonusBalance - a.BonusBalance);

    if (suspicious.length === 0) {
      console.log('✅ No suspicious active accounts found based on current criteria.');
    } else {
      console.log(`🚨 Found ${suspicious.length} suspicious active accounts:\n`);
      console.table(suspicious);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during scan:', error);
    process.exit(1);
  }
}

scanAbusers();
