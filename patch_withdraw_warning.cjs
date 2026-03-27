const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

const warningBanner = `
      <!-- 하락장 이벤트 출금 경고 -->
      <div id="withdrawBearWarning" style="margin-bottom:14px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; padding: 12px; font-size: 13px; color: #ef4444; font-weight: 600; display: flex; align-items: flex-start; gap: 8px;">
        <i class="fas fa-exclamation-triangle" style="margin-top: 2px;"></i>
        <div>
          <span style="display:block; margin-bottom: 2px; font-size: 14px;">주의: 하락장 보상 이벤트 제외 안내</span>
          <span style="font-weight: 400; font-size: 12px; color: #f87171;">출금 이력이 발생하면 현재 진행 중이거나 향후 진행될 <strong style="color: #ef4444;">'하락장 보상 이벤트(입금 보너스)' 대상에서 영구적으로 제외</strong>됩니다. 계속 진행하시겠습니까?</span>
        </div>
      </div>
`;

if (!html.includes('withdrawBearWarning')) {
  html = html.replace('<!-- 출금 가능 USDT -->', warningBanner + '\n      <!-- 출금 가능 USDT -->');
  fs.writeFileSync('public/index.html', html);
  console.log('Added withdrawal warning to index.html');
} else {
  console.log('Warning already exists.');
}
