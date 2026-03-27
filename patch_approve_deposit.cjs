const fs = require('fs');
let code = fs.readFileSync('public/static/js/api.js', 'utf8');

const target = `      const batch = writeBatch(db);
      batch.update(doc(db, 'transactions', txId), {
        status: 'approved', approvedAt: serverTimestamp(), approvedBy: adminId
      });
      // 지갑 잔액 증가
      const walletQ = query(collection(db, 'wallets'), where('userId', '==', tx.userId));
      const wSnap = await getDocs(walletQ);
      if (!wSnap.empty) {
        batch.update(wSnap.docs[0].ref, {
          usdtBalance: increment(parseFloat(tx.amount) || 0),
          totalDeposit: increment(parseFloat(tx.amount) || 0),
        });
      }
      await batch.commit();`;

if (!code.includes(target)) {
  console.log("Target not found!");
  process.exit(1);
}
console.log("Target found!");
