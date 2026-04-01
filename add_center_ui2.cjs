const fs = require('fs');
const path = '/home/user/webapp/public/static/app.v3.js';
let code = fs.readFileSync(path, 'utf8');

// Replace the previous window.submitCenterWithdraw block
code = code.replace(/window\.submitCenterWithdraw = async function\(\) \{[\s\S]*?\};\n/, `window.submitCenterWithdraw = async function() {
  if (userData && userData.withdrawSuspended) {
    showToast('일정기간 출금금지 계정입니다', 'error');
    return;
  }
  
  if (!walletData || !walletData.walletAddress) {
    showToast('지갑 주소를 먼저 등록해주세요.', 'error');
    showWalletRegisterModal();
    return;
  }

  const amtStr = document.getElementById('centerWithdrawAmount').value.trim();
  const amt = parseFloat(amtStr);
  const type = document.getElementById('centerWithdrawType').value;
  const maxAmt = type === 'center_fee' ? parseFloat(walletData.centerBalance || 0) : parseFloat(walletData.subCenterBalance || 0);

  if (isNaN(amt) || amt < 5) {
    showToast('최소 5 USDT 이상 출금 가능합니다.', 'error');
    return;
  }
  if (amt > maxAmt) {
    showToast('출금 가능 수당이 부족합니다.', 'error');
    return;
  }

  const btn = window.event ? (window.event.currentTarget || window.event.target) : null;
  if (btn) { btn.disabled = true; btn.textContent = '처리중...'; }

  try {
    const { collection, db, serverTimestamp, doc, writeBatch, increment } = window.FB;
    const batch = writeBatch(db);
    
    const price = deedraPrice || 0.5;
    const ddrAmt = amt / price;

    const txRef = doc(collection(db, 'transactions'));
    batch.set(txRef, {
      userId: currentUser.uid, userEmail: currentUser.email || null,
      type: type, // 'center_fee' 또는 'sub_center_fee'
      amountDdra: ddrAmt,
      amountUsdt: amt,
      amount: ddrAmt,
      currency: 'DDRA',
      ddraPrice: price,
      walletAddress: walletData.walletAddress,
      feeRate: 0, feeAmount: 0, netUsdt: amt,
      status: 'pending', createdAt: serverTimestamp(),
    });

    const walletRef = doc(db, 'wallets', currentUser.uid);
    if (type === 'center_fee') {
      batch.update(walletRef, {
        centerBalance: increment(-amt)
      });
    } else {
      batch.update(walletRef, {
        subCenterBalance: increment(-amt)
      });
    }

    await batch.commit();

    if (walletData) {
      if (type === 'center_fee') {
        walletData.centerBalance = Math.max(0, (walletData.centerBalance || 0) - amt);
      } else {
        walletData.subCenterBalance = Math.max(0, (walletData.subCenterBalance || 0) - amt);
      }
    }

    showToast('출금 신청이 완료되었습니다.', 'success');
    closeModal('centerWithdrawModal');
    if (typeof loadMorePage === 'function') loadMorePage();

  } catch(e) {
    console.error(e);
    showToast('출금 신청 실패: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '출금 신청'; }
  }
};
`);

fs.writeFileSync(path, code);
