const fs = require('fs');

let code = fs.readFileSync('public/static/admin.html', 'utf8');

// Find the variable declarations
const varDecl = `let _trc20AutoPollActive = false;
let _trc20AutoPollInterval = null;`;

const newVarDecl = `let _trc20AutoPollActive = localStorage.getItem('deedra_trc20_autopoll') === 'true';
let _trc20AutoPollInterval = null;`;

code = code.replace(varDecl, newVarDecl);

// Find toggleTrc20AutoPoll
const toggleFunc = `window.toggleTrc20AutoPoll = function() {
  const btn = document.getElementById('trc20AutoPollBtn');
  if (_trc20AutoPollActive) {
    clearInterval(_trc20AutoPollInterval);
    _trc20AutoPollInterval = null;
    _trc20AutoPollActive   = false;
    if (btn) btn.textContent = '⏱ 자동감지 OFF';
    if (btn) btn.style.background = '#4f46e5';
    showToast('⏹ Solana 자동 감지를 중지했습니다.');
  } else {
    _trc20AutoPollActive = true;
    if (btn) btn.textContent = '⏱ 자동감지 ON (5분)';
    if (btn) btn.style.background = '#ef4444';
    showToast('▶ Solana 자동 감지 시작 (5분 간격)');
    window.checkTrc20Deposits();
    _trc20AutoPollInterval = setInterval(() => {
      window.checkTrc20Deposits();
    }, 5 * 60 * 1000);
  }
};`;

const newToggleFunc = `window.toggleTrc20AutoPoll = function(isInit = false) {
  const btn = document.getElementById('trc20AutoPollBtn');
  
  if (!isInit) {
      _trc20AutoPollActive = !_trc20AutoPollActive;
      localStorage.setItem('deedra_trc20_autopoll', _trc20AutoPollActive);
  }

  if (!_trc20AutoPollActive) {
    if (_trc20AutoPollInterval) clearInterval(_trc20AutoPollInterval);
    _trc20AutoPollInterval = null;
    if (btn) {
        btn.textContent = '⏱ 자동감지 OFF';
        btn.style.background = '#4f46e5';
    }
    if (!isInit) showToast('⏹ Solana 자동 감지를 중지했습니다.');
  } else {
    if (btn) {
        btn.textContent = '⏱ 자동감지 ON (5분)';
        btn.style.background = '#ef4444';
    }
    if (!isInit) showToast('▶ Solana 자동 감지 시작 (5분 간격)');
    
    if (_trc20AutoPollInterval) clearInterval(_trc20AutoPollInterval);
    
    if (!isInit) window.checkTrc20Deposits();
    _trc20AutoPollInterval = setInterval(() => {
      window.checkTrc20Deposits();
    }, 5 * 60 * 1000);
  }
};`;

code = code.replace(toggleFunc, newToggleFunc);

// Now we need to call toggleTrc20AutoPoll(true) on load.
// Let's find an initialization block.
const initBlock = `document.addEventListener('DOMContentLoaded', async () => {`;
const newInitBlock = `document.addEventListener('DOMContentLoaded', async () => {
  // 자동 감지 상태 복원
  setTimeout(() => {
    if (_trc20AutoPollActive) {
      window.toggleTrc20AutoPoll(true);
    }
  }, 1000);`;

code = code.replace(initBlock, newInitBlock);

fs.writeFileSync('public/static/admin.html', code);
console.log("Patch applied to admin.html");
