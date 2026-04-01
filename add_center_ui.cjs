const fs = require('fs');
const path = '/home/user/webapp/public/static/app.v3.js';
let code = fs.readFileSync(path, 'utf8');

const newCode = `

// ============================================================================
// 센터 및 부센터 정산 관리 로직
// ============================================================================

window.showCenterSettlement = function() {
  if (!walletData || !userData) return;
  const balance = parseFloat(walletData.centerBalance || 0);
  document.getElementById('centerWithdrawModalTitle').textContent = '🏢 센터 수당 출금 신청';
  document.getElementById('centerWithdrawAvailable').textContent = fmt(balance);
  document.getElementById('centerWithdrawAvailableDdra').textContent = '≈ ' + fmt(balance / (deedraPrice || 0.5)) + ' DDRA';
  document.getElementById('centerWithdrawAmount').value = '';
  document.getElementById('centerWithdrawEstimatedDdra').textContent = '0.00';
  document.getElementById('centerWithdrawType').value = 'center_fee';
  document.getElementById('centerWithdrawModal').classList.remove('hidden');
};

window.showSubCenterSettlement = function() {
  if (!walletData || !userData) return;
  const balance = parseFloat(walletData.subCenterBalance || 0);
  document.getElementById('centerWithdrawModalTitle').textContent = '👔 부센터장 수당 출금 신청';
  document.getElementById('centerWithdrawAvailable').textContent = fmt(balance);
  document.getElementById('centerWithdrawAvailableDdra').textContent = '≈ ' + fmt(balance / (deedraPrice || 0.5)) + ' DDRA';
  document.getElementById('centerWithdrawAmount').value = '';
  document.getElementById('centerWithdrawEstimatedDdra').textContent = '0.00';
  document.getElementById('centerWithdrawType').value = 'sub_center_fee';
  document.getElementById('centerWithdrawModal').classList.remove('hidden');
};

window.updateCenterWithdrawDdraEstimation = function() {
  const amtEl = document.getElementById('centerWithdrawAmount');
  const estEl = document.getElementById('centerWithdrawEstimatedDdra');
  if (!estEl) return;
  const usdtAmt = parseFloat(amtEl.value) || 0;
  const price = deedraPrice || 0.5;
  if (usdtAmt > 0 && price > 0) {
    estEl.textContent = fmt(usdtAmt / price);
  } else {
    estEl.textContent = '0.00';
  }
};

window.submitCenterWithdraw = async function() {
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

  try {
    const payload = {
      type: type, // 'center_fee' 또는 'sub_center_fee'
      amount: amt,
      amountUsdt: amt,
      status: 'pending',
      walletAddress: walletData.walletAddress
    };

    const res = await api.createTransaction(currentUser.uid, payload);
    if (res && res.success) {
      showToast('출금 신청이 완료되었습니다.', 'success');
      closeModal('centerWithdrawModal');
      await initUserData();
    } else {
      throw new Error(res.error || '알 수 없는 오류');
    }
  } catch(e) {
    console.error(e);
    showToast('출금 신청 실패: ' + e.message, 'error');
  }
};

`;

fs.writeFileSync(path, code + newCode);
