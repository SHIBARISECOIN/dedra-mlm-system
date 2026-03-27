const fs = require('fs');
let indexHtml = fs.readFileSync('/home/user/webapp/public/index.html', 'utf8');

const targetStr = `<div class="modal-title" data-i18n="modalDeposit">💰 USDT 입금</div>`;
const injection = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <div class="modal-title" style="margin-bottom:0;" data-i18n="modalDeposit">💰 USDT 입금</div>
      <button onclick="startTutorial()" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: 0.2s;">
        <i class="fas fa-magic"></i> <span id="depModalGuideText" data-i18n="guideFloatText">입금 방법 안내</span>
      </button>
    </div>`;

if (indexHtml.includes(targetStr)) {
  indexHtml = indexHtml.replace(targetStr, injection);
  fs.writeFileSync('/home/user/webapp/public/index.html', indexHtml);
  console.log('Patched deposit modal title with guide button');
} else {
  console.log('Target string not found in index.html');
}
