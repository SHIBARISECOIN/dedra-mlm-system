const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function checkUser() {
  try {
    const email = 'hsy7948@deedra.com';
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      console.log(`User ${email} not found in Firestore.`);
      process.exit(0);
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const uid = userDoc.id;

    console.log(`\n=== User Info ===`);
    console.log(`Email: ${email}`);
    console.log(`UID: ${uid}`);
    console.log(`Status: ${userData.status || 'active'}`);
    console.log(`Created At: ${userData.createdAt ? userData.createdAt.toDate().toISOString() : 'N/A'}`);

    // Check wallet
    const walletDoc = await db.collection('wallets').doc(uid).get();
    if (walletDoc.exists) {
      const walletData = walletDoc.data();
      console.log(`\n=== Wallet Balances ===`);
      console.log(`Bonus Balance (DDRA/Game Money): ${walletData.bonusBalance || 0}`);
      console.log(`USDT Balance: ${walletData.usdtBalance || 0}`);
      console.log(`DDRA Balance: ${walletData.ddraBalance || 0}`);
      console.log(`Total Invested: ${walletData.totalInvested || 0}`);
    } else {
      console.log(`\nWallet not found for ${uid}`);
    }

    // Check game logs
    console.log(`\n=== Game Logs Summary ===`);
    const gamelogsRef = db.collection('gamelogs');
    const logsSnapshot = await gamelogsRef.where('userId', '==', uid).get();
    
    let totalBet = 0;
    let netProfitDdra = 0; 
    let gamesCount = {
      baccarat: 0,
      roulette: 0,
      slot: 0,
      dice: 0,
      oddeven: 0,
      poker: 0
    };

    logsSnapshot.forEach(doc => {
      const log = doc.data();
      const bet = log.bet || 0;
      const change = log.ddraChange || 0; 
      
      totalBet += bet;
      netProfitDdra += change;
      
      if (log.game === '바카라') gamesCount.baccarat++;
      else if (log.game === '룰렛') gamesCount.roulette++;
      else if (log.game === '슬롯머신') gamesCount.slot++;
      else if (log.game === '주사위') gamesCount.dice++;
      else if (log.game === '홀짝') gamesCount.oddeven++;
      else if (log.game === '포커') gamesCount.poker++;
      else gamesCount[log.game] = (gamesCount[log.game] || 0) + 1;
    });

    console.log(`Total Games Played: ${logsSnapshot.size}`);
    console.log(`Game Breakdown:`, gamesCount);
    console.log(`Total DDRA Bet: ${totalBet}`);
    console.log(`Net DDRA Profit (User): ${netProfitDdra}`);
    console.log(`Company Net Loss: ${-netProfitDdra}`);

    // Check recent transactions
    console.log(`\n=== Recent Transactions ===`);
    const txRef = db.collection('users').doc(uid).collection('transactions');
    const txSnapshot = await txRef.get();
    
    let totalWithdrawn = 0;
    
    if (txSnapshot.empty) {
      console.log('No transactions found.');
    } else {
      const txs = [];
      txSnapshot.forEach(doc => {
        txs.push({ id: doc.id, ...doc.data() });
      });
      
      txs.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      txs.forEach(tx => {
        const dateStr = tx.createdAt && tx.createdAt.toDate ? tx.createdAt.toDate().toISOString() : 'N/A';
        console.log(`[${dateStr}] Type: ${tx.type} | Amount: ${tx.amount} DDRA | Status: ${tx.status}`);
        
        if (tx.type === 'withdrawal' && (tx.status === 'approved' || tx.status === 'pending')) {
          totalWithdrawn += (tx.amount || 0);
        }
      });
      console.log(`\nTotal Withdrawn (Approved/Pending): ${totalWithdrawn} DDRA`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
