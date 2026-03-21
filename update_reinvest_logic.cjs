const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public/static/app.js');
let js = fs.readFileSync(appJsPath, 'utf8');

// Replace showReinvestModal and submitReinvest
const showReinvestRegex = /window\.showReinvestModal = function\(\) \{[\s\S]*?window\.submitReinvest = async function\(\) \{[\s\S]*?\}\s*;/;

const newLogic = `window.showReinvestModal = async function() {
  const bonus = walletData?.bonusBalance || 0;
  const maxEl = document.getElementById('reinvestMaxAmount');
  if (maxEl) maxEl.innerHTML = fmt(bonus) + ' <span style="font-size:14px;">USDT</span>';
  document.getElementById('reinvestInputAmount').value = '';
  
  // Populate Product Select
  const sel = document.getElementById('reinvestProductSelect');
  if (sel) {
    if (!productsCache || !productsCache.length) {
      try {
        const { collection, getDocs, db } = window.FB;
        const snap = await getDocs(collection(db, 'products'));
        const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        productsCache = allDocs
          .filter(p => (!p.type || p.type === 'investment') && p.isActive !== false)
          .sort((a, b) => (a.sortOrder || a.minAmount || 0) - (b.sortOrder || b.minAmount || 0));
      } catch(e) { console.error('Failed to load products for reinvest', e); }
    }
    
    sel.innerHTML = '<option value="">상품 선택 (기간 / 데일리 이율)</option>';
    if (productsCache && productsCache.length) {
      productsCache.forEach(p => {
        const roi = p.roiPercent != null ? p.roiPercent : (p.dailyRoi != null ? p.dailyRoi : 0);
        const days = p.durationDays != null ? p.durationDays : (p.duration != null ? p.duration : 0);
        sel.innerHTML += \`<option value="\${p.id}">\${p.name} (\${roi}% / \${days}일)</option>\`;
      });
      // Auto-select first item if exists
      if (productsCache.length > 0) sel.value = productsCache[0].id;
    } else {
      sel.innerHTML = '<option value="">진행 가능한 상품이 없습니다</option>';
    }
  }

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

  const sel = document.getElementById('reinvestProductSelect');
  if (!sel || !sel.value) { showToast('재투자할 상품을 선택해 주세요.', 'warning'); return; }
  
  const selectedProduct = productsCache.find(p => p.id === sel.value);
  if (!selectedProduct) { showToast('상품 정보를 찾을 수 없습니다.', 'error'); return; }
  
  if (inputAmt < (selectedProduct.minAmount || selectedProduct.minAmt || 0)) { 
      showToast('최소 투자 금액은 ' + (selectedProduct.minAmount || selectedProduct.minAmt) + ' USDT 입니다.', 'warning'); 
      return; 
  }

  const btn = event.target;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '처리중...';

  try {
    const { doc, writeBatch, increment, serverTimestamp, collection, db } = window.FB;
    const batch = writeBatch(db);
    
    // 1) 지갑 업데이트 (bonusBalance 차감, totalInvest 증가) - usdtBalance는 건드리지 않음
    const walletRef = doc(db, 'wallets', currentUser.uid);
    batch.update(walletRef, {
      bonusBalance: increment(-inputAmt),
      totalInvest: increment(inputAmt)
    });

    // 2) 신규 투자 상품 도큐먼트 생성
    const startDate = new Date();
    const days = selectedProduct.durationDays != null ? selectedProduct.durationDays : (selectedProduct.duration || 0);
    const roi = selectedProduct.roiPercent != null ? selectedProduct.roiPercent : (selectedProduct.dailyRoi || 0);
    const endDate = new Date(startDate.getTime() + days * 86400000);
    const expectedReturn = (inputAmt * roi / 100);

    const invRef = doc(collection(db, 'investments'));
    batch.set(invRef, {
      userId: currentUser.uid, 
      productId: selectedProduct.id,
      productName: selectedProduct.name, 
      amount: inputAmt,
      roiPercent: roi, 
      durationDays: days,
      expectedReturn, 
      status: 'active',
      startDate: serverTimestamp(), 
      endDate,
      createdAt: serverTimestamp(),
      isReinvest: true // 재투자 마킹
    });

    // 3) 트랜잭션 기록 (Reinvest -> Invest)
    const txRef = doc(collection(db, 'transactions'));
    batch.set(txRef, {
      userId: currentUser.uid,
      type: 'invest',
      amount: inputAmt,
      currency: 'USDT',
      status: 'active',
      reason: '수익금 재투자 (FREEZE 가입: ' + selectedProduct.name + ')',
      createdAt: serverTimestamp()
    });

    await batch.commit();

    // 로컬 업데이트
    if (walletData) {
      walletData.bonusBalance -= inputAmt;
      walletData.totalInvest = (walletData.totalInvest || 0) + inputAmt;
    }
    
    closeModal('reinvestModal');
    showToast('수익금 재투자가 완료되었습니다!', 'success');
    updateWalletUI();
    if (typeof loadRecentTransactions === 'function') loadRecentTransactions();
    if (typeof loadMyInvestments === 'function') loadMyInvestments();
    if (typeof loadTxHistory === 'function') loadTxHistory('all');
  } catch (err) {
    console.error('Reinvest Error:', err);
    showToast('재투자 처리 중 오류가 발생했습니다: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};`;

if (js.match(showReinvestRegex)) {
    js = js.replace(showReinvestRegex, newLogic);
    fs.writeFileSync(appJsPath, js);
    console.log('Updated reinvest logic in app.js');
} else {
    console.log('Regex did not match for Reinvest in app.js');
}
