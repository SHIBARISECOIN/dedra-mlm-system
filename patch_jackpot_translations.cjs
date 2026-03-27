const fs = require('fs');
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

// KO
appJs = appJs.replace(
  /typeDeposit: '입금',\n/g,
  `typeDeposit: '입금',\n    jackpotCurrentPrize: '현재 누적 잭팟 상금',\n    jackpotRule1: '타이머 종료 시 <strong style="color: #38bdf8;">마지막 입금자</strong>가 당첨금을 독식합니다!',\n    jackpotRule2: '(입금 시 당첨금으로 즉시 상품 구매 가능하도록 계정 충전)',\n`
);

// EN
appJs = appJs.replace(
  /typeDeposit: 'Deposit',\n/g,
  `typeDeposit: 'Deposit',\n    jackpotCurrentPrize: 'Current Accumulated Jackpot',\n    jackpotRule1: 'When the timer ends, the <strong style="color: #38bdf8;">last depositor</strong> takes all the prize money!',\n    jackpotRule2: '(Prize is credited to allow immediate product purchase)',\n`
);

// VI
appJs = appJs.replace(
  /typeDeposit: 'Nạp',\n/g,
  `typeDeposit: 'Nạp',\n    jackpotCurrentPrize: 'Giải thưởng Jackpot hiện tại',\n    jackpotRule1: 'Khi hết thời gian, <strong style="color: #38bdf8;">người nạp tiền cuối cùng</strong> sẽ nhận toàn bộ tiền thưởng!',\n    jackpotRule2: '(Tiền thưởng được nạp vào tài khoản để mua sản phẩm ngay)',\n`
);

// TH
appJs = appJs.replace(
  /typeDeposit: 'ฝาก',\n/g,
  `typeDeposit: 'ฝาก',\n    jackpotCurrentPrize: 'รางวัลแจ็คพอตสะสมปัจจุบัน',\n    jackpotRule1: 'เมื่อหมดเวลา <strong style="color: #38bdf8;">ผู้ฝากเงินคนสุดท้าย</strong> จะได้รับเงินรางวัลทั้งหมด!',\n    jackpotRule2: '(เงินรางวัลจะเข้าบัญชีเพื่อให้สามารถซื้อสินค้าได้ทันที)',\n`
);

// Replace the HTML generation part
appJs = appJs.replace(
  /<div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">현재 누적 잭팟 상금<\/div>/g,
  `<div style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">\${t('jackpotCurrentPrize')}</div>`
);

appJs = appJs.replace(
  /타이머 종료 시 <strong style="color: #38bdf8;">마지막 입금자<\/strong>가 당첨금을 독식합니다!<br>\n\s*\(입금 시 당첨금으로 즉시 상품 구매 가능하도록 계정 충전\)/g,
  `\${t('jackpotRule1')}<br>\n        \${t('jackpotRule2')}`
);

fs.writeFileSync('public/static/app.js', appJs);
console.log('Jackpot translations patched successfully.');
