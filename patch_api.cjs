const fs = require('fs');

const targetFile = 'public/static/js/api.js';
let content = fs.readFileSync(targetFile, 'utf8');

const approveFuncIndex = content.indexOf('async approveWithdrawal(txId, adminId, txid) {');

if (approveFuncIndex > -1) {
  const injectCode = `
  async markWithdrawalProcessing(txId, adminId) {
    try {
      const db = this.db;
      // We do a transaction to ensure no double-processing
      const txRef = doc(db, 'transactions', txId);
      const res = await runTransaction(db, async (t) => {
        const txSnap = await t.get(txRef);
        if (!txSnap.exists()) throw new Error('거래 없음');
        const tx = txSnap.data();
        if (tx.status !== 'pending') {
          if (tx.status === 'processing') throw new Error('이미 다른 관리자가 처리 중(송금 진행 중)인 건입니다. 중복 송금 위험이 있어 차단되었습니다.');
          throw new Error('이미 처리된 거래입니다. 상태: ' + tx.status);
        }
        // Mark as processing
        t.update(txRef, {
          status: 'processing',
          processingAt: serverTimestamp(),
          processingBy: adminId
        });
        return true;
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async unmarkWithdrawalProcessing(txId, adminId) {
    try {
      const db = this.db;
      await updateDoc(doc(db, 'transactions', txId), {
        status: 'pending',
        processingFailedAt: serverTimestamp()
      });
      return { success: true };
    } catch(e) {
      return { success: false };
    }
  }

  `;
  
  content = content.slice(0, approveFuncIndex) + injectCode + content.slice(approveFuncIndex);
  
  // also need to change approveWithdrawal to accept 'processing' status
  content = content.replace(
    "if (tx.status !== 'pending') throw new Error('이미 처리된 거래입니다');",
    "if (tx.status !== 'pending' && tx.status !== 'processing') throw new Error('처리 가능한 상태가 아닙니다 (' + tx.status + ')');"
  );
  
  // also need to import runTransaction if not imported
  if (!content.includes('runTransaction')) {
    content = content.replace('import { ', 'import { runTransaction, ');
  }

  fs.writeFileSync(targetFile, content);
  console.log('Patched api.js successfully!');
} else {
  console.log('Failed to find target function in api.js');
}
