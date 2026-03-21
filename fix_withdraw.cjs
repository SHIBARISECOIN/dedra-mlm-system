const fs = require('fs');
let app = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// Update showWithdrawModal
app = app.replace(
`window.showWithdrawModal = function() {
  const bonus = walletData?.bonusBalance || 0;
  const bonusDdra = bonus / (deedraPrice || 0.5);  // DDRA 환산
  // 출금 가능 DDRA 표시
  const avEl = document.getElementById('withdrawAvailable');
  if (avEl) avEl.textContent = fmt(bonusDdra);
  // USDT 환산 부제목
  const avUsdtEl = document.getElementById('withdrawAvailableUsdt');
  if (avUsdtEl) avUsdtEl.textContent = '≈ $' + fmt(bonus) + ' USDT';
  updateWithdrawDdraCalc();
  document.getElementById('withdrawModal').classList.remove('hidden');
};`,
`window.showWithdrawModal = function() {
  const bonus = walletData?.bonusBalance || 0;
  const bonusDdra = bonus / (deedraPrice || 0.5);  // DDRA 환산
  // 출금 가능 USDT 표시
  const avEl = document.getElementById('withdrawAvailable');
  if (avEl) avEl.textContent = fmt(bonus);
  // DDRA 환산 부제목
  const avDdraEl = document.getElementById('withdrawAvailableDdra');
  if (avDdraEl) avDdraEl.textContent = '≈ ' + fmt(bonusDdra) + ' DDRA';
  updateWithdrawDdraCalc();
  document.getElementById('withdrawModal').classList.remove('hidden');
};`);

// Update updateWithdrawDdraCalc
app = app.replace(
`function updateWithdrawDdraCalc() {
  const amtEl = document.getElementById('withdrawAmount');
  const calcEl = document.getElementById('withdrawDdraCalc');
  if (!calcEl) return;
  const ddrAmt = parseFloat(amtEl?.value || '0') || 0;
  const price = deedraPrice || 0.5;
  if (ddrAmt > 0 && price > 0) {
    const usdtAmt = ddrAmt * price;
    calcEl.textContent = \`≈ $\${fmt(usdtAmt)} USDT (1 DDRA = $\${price.toFixed(4)} USDT)\`;
    calcEl.style.color = '#f59e0b';
  } else {
    calcEl.textContent = \`1 DDRA = $\${price.toFixed(4)} USDT\`;
    calcEl.style.color = '#94a3b8';
  }
}`,
`function updateWithdrawDdraCalc() {
  const amtEl = document.getElementById('withdrawAmount');
  const calcEl = document.getElementById('withdrawDdraCalc');
  if (!calcEl) return;
  const usdtAmt = parseFloat(amtEl?.value || '0') || 0;
  const price = deedraPrice || 0.5;
  if (usdtAmt > 0 && price > 0) {
    const ddrAmt = usdtAmt / price;
    calcEl.textContent = \`예상 지급 수량: \${fmt(ddrAmt)} DDRA (1 DDRA = $\${price.toFixed(4)} USDT)\`;
    calcEl.style.color = '#f59e0b';
  } else {
    calcEl.textContent = \`예상 지급 수량: 0.00 DDRA (1 DDRA = $\${price.toFixed(4)} USDT)\`;
    calcEl.style.color = '#94a3b8';
  }
}`);

// Update submitWithdraw
app = app.replace(
`window.submitWithdraw = async function() {
  // 입력값: DDRA 수량
  const ddrAmt = parseFloat(document.getElementById('withdrawAmount').value);
  const address = document.getElementById('withdrawAddress').value.trim();
  const pin = document.getElementById('withdrawPin').value.trim();

  if (!ddrAmt || ddrAmt <= 0) { showToast(t('toastEnterWithAmt'), 'warning'); return; }
  if (!address) { showToast(t('toastEnterWithAddr'), 'warning'); return; }
  if (!pin || pin.length !== 6) { showToast(t('toastEnterPin'), 'warning'); return; }
  if (!/^\\d{6}$/.test(pin)) { showToast('PIN은 숫자 6자리여야 합니다.', 'warning'); return; }

  // PIN 미설정 시 설정 유도
  if (!userData?.withdrawPin) {
    showToast('출금 PIN이 설정되지 않았습니다. 먼저 PIN을 설정해주세요.', 'warning');
    closeModal('withdrawModal');
    setTimeout(() => showWithdrawPinSetup(), 300);
    return;
  }

  const price = deedraPrice || 0.5;
  const amountUsdt = ddrAmt * price;  // USDT 환산

  // 출금 가능 금액 = bonusBalance(USDT) → DDRA 환산 기준
  const availableBonus = walletData?.bonusBalance || 0;
  const availableDdra = availableBonus / price;
  if (availableDdra < ddrAmt) {
    showToast(\`출금 가능 DDRA 부족 (가능: \${fmt(availableDdra)} DDRA)\`, 'error'); return;
  }`,
`window.submitWithdraw = async function() {
  // 입력값: USDT 수량
  const amountUsdt = parseFloat(document.getElementById('withdrawAmount').value);
  const address = document.getElementById('withdrawAddress').value.trim();
  const pin = document.getElementById('withdrawPin').value.trim();

  if (!amountUsdt || amountUsdt <= 0) { showToast('출금할 금액을 입력하세요', 'warning'); return; }
  if (!address) { showToast(t('toastEnterWithAddr'), 'warning'); return; }
  if (!pin || pin.length !== 6) { showToast(t('toastEnterPin'), 'warning'); return; }
  if (!/^\\d{6}$/.test(pin)) { showToast('PIN은 숫자 6자리여야 합니다.', 'warning'); return; }

  // PIN 미설정 시 설정 유도
  if (!userData?.withdrawPin) {
    showToast('출금 PIN이 설정되지 않았습니다. 먼저 PIN을 설정해주세요.', 'warning');
    closeModal('withdrawModal');
    setTimeout(() => showWithdrawPinSetup(), 300);
    return;
  }

  const price = deedraPrice || 0.5;
  const ddrAmt = amountUsdt / price;  // DDRA 환산

  // 출금 가능 금액 = bonusBalance(USDT)
  const availableBonus = walletData?.bonusBalance || 0;
  if (availableBonus < amountUsdt) {
    showToast(\`출금 가능 USDT 부족 (가능: \${fmt(availableBonus)} USDT)\`, 'error'); return;
  }`);

fs.writeFileSync('/home/user/webapp/public/static/app.js', app);
console.log("Withdraw replaced.");
