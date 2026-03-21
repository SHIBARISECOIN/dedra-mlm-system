const fs = require('fs');
let app = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

const codeToInsert = `
// ===== 재투자 기능 =====
window.showReinvestModal = function() {
  const bonus = walletData?.bonusBalance || 0;
  const maxEl = document.getElementById('reinvestMaxAmount');
  if (maxEl) maxEl.innerHTML = fmt(bonus) + ' <span style="font-size:14px;">USDT</span>';
  document.getElementById('reinvestInputAmount').value = '';
  document.getElementById('reinvestModal').classList.remove('hidden');
};

window.setReinvestPercent = function(pct) {
  const bonus = walletData?.bonusBalance || 0;
  let amt = bonus * (pct / 100);
  if (pct === 100) amt = bonus;
  document.getElementById('reinvestInputAmount').value = Math.floor(amt * 100) / 100;
};

window.submitReinvest = async function() {
  const inputAmt = parseFloat(document.getElementById('reinvestInputAmount').value);
  if (!inputAmt || inputAmt <= 0) { showToast('금액을 입력하세요.', 'warning'); return; }
  const bonus = walletData?.bonusBalance || 0;
  if (inputAmt > bonus) { showToast('출금 가능 수익금이 부족합니다.', 'warning'); return; }

  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '처리중...';

  try {
    const { doc, writeBatch, increment, serverTimestamp, collection, db } = window.FB;
    const batch = writeBatch(db);
    
    // 1) 지갑 업데이트 (bonusBalance 차감, usdtBalance 증가)
    const walletRef = doc(db, 'wallets', currentUser.uid);
    batch.update(walletRef, {
      bonusBalance: increment(-inputAmt),
      usdtBalance: increment(inputAmt)
    });

    // 2) 트랜잭션 기록
    const txRef = doc(collection(db, 'transactions'));
    batch.set(txRef, {
      userId: currentUser.uid,
      type: 'reinvest',
      amount: inputAmt,
      amountUsdt: inputAmt,
      currency: 'USDT',
      status: 'approved',
      reason: '수익금 재투자 (원금 전환)',
      createdAt: serverTimestamp()
    });

    await batch.commit();

    // 로컬 업데이트
    if (walletData) {
      walletData.bonusBalance -= inputAmt;
      walletData.usdtBalance = (walletData.usdtBalance || 0) + inputAmt;
    }
    
    closeModal('reinvestModal');
    showToast('재투자가 완료되었습니다. FREEZE 탭으로 이동합니다.', 'success');
    
    // UI 갱신 및 탭 이동
    updateWalletUI();
    updateHomeUI();
    switchPage('invest');
  } catch (err) {
    showToast('재투자 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};
`;

// Insert after submitWithdraw
app = app.replace('window.submitWithdraw = async function() {', codeToInsert + '\nwindow.submitWithdraw = async function() {');

fs.writeFileSync('/home/user/webapp/public/static/app.js', app);
console.log("Reinvest logic added.");
