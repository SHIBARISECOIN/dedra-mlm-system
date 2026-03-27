const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const target = `            if (drop < 0) {
              const bonusPct = Math.abs(drop);
              bearBanner.innerHTML = \\\`📉 <strong>하락장 보상 이벤트 진행중!</strong><br><span style="color:#ef4444;font-size:14px;">현재 하락률 \\\${bonusPct.toFixed(2)}%</span> 만큼 입금 시 USDT 보너스가 추가 지급됩니다!\\\`;
              bearBanner.style.background = '#fee2e2';
              bearBanner.style.border = '1px solid #fca5a5';
              bearBanner.style.color = '#991b1b';
              bearBanner.style.display = 'block';
            } else {
              bearBanner.style.display = 'none';
            }`;

const replacement = `            if (drop < 0) {
              const bonusPct = Math.floor(Math.abs(drop));
              bearBanner.innerHTML = \\\`📉 <strong>하락장 보상 이벤트 진행중!</strong><br><span style="color:#ef4444;font-size:14px;">현재 하락률 \\\${bonusPct}%</span> 만큼 입금 시 USDT 보너스가 추가 지급됩니다!\\\`;
              bearBanner.style.background = '#fee2e2';
              bearBanner.style.border = '1px solid #fca5a5';
              bearBanner.style.color = '#991b1b';
              bearBanner.style.display = 'block';
            } else {
              bearBanner.style.display = 'none';
            }`;

code = code.replace(target, replacement);
fs.writeFileSync('public/static/app.js', code);
console.log('Banner text updated correctly');
