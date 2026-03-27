const admin = require('firebase-admin');
const sa = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function checkUserTxs() {
  try {
    const uid = 'ulSSEiBR8mhajC9s5Ii1NSbCoij1';

    // Check recent transactions without ordering by createdAt to avoid index error
    console.log(`\n=== All Transactions for hsy2802@deedra.com ===`);
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
      
      // Sort in memory
      txs.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      txs.forEach(tx => {
        const dateStr = tx.createdAt && tx.createdAt.toDate ? tx.createdAt.toDate().toISOString() : 'N/A';
        console.log(`[${dateStr}] Type: ${tx.type} | Amount: ${tx.amount} DDRA | USDT: ${tx.amountUsdt} | Status: ${tx.status}`);
        
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

checkUserTxs();
