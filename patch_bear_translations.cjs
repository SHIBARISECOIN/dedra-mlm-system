const fs = require('fs');
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

// Insert ko translations
appJs = appJs.replace(
  /typeDeposit: '입금',\n/g,
  `typeDeposit: '입금',\n    bearMarketBubble: '% 추가 지급 진행중!!',\n    bearMarketBanner: '📉 <strong>하락장 보상 이벤트 진행중!</strong><br><span style=\"color:#ef4444;font-size:14px;\">현재 하락률 {bonusPct}%</span> 만큼 입금 시 USDT 보너스가 추가 지급됩니다!',\n`
);

// Insert en translations
appJs = appJs.replace(
  /typeDeposit: 'Deposit',\n/g,
  `typeDeposit: 'Deposit',\n    bearMarketBubble: '% Extra Bonus Active!!',\n    bearMarketBanner: '📉 <strong>Bear Market Event Active!</strong><br><span style=\"color:#ef4444;font-size:14px;\">Current Drop: {bonusPct}%</span> — Deposit now to receive an equivalent USDT bonus!',\n`
);

// Insert vi translations
appJs = appJs.replace(
  /typeDeposit: 'Nạp tiền',\n/g,
  `typeDeposit: 'Nạp tiền',\n    bearMarketBubble: '% Thưởng thêm đang diễn ra!!',\n    bearMarketBanner: '📉 <strong>Sự kiện bù đắp thị trường gấu đang diễn ra!</strong><br><span style=\"color:#ef4444;font-size:14px;\">Mức giảm hiện tại: {bonusPct}%</span> — Nạp ngay để nhận thưởng USDT tương đương!',\n`
);

// Insert th translations
appJs = appJs.replace(
  /typeDeposit: 'ฝาก',\n/g,
  `typeDeposit: 'ฝาก',\n    bearMarketBubble: '% โบนัสพิเศษทำงานอยู่!!',\n    bearMarketBanner: '📉 <strong>กิจกรรมตลาดหมีกำลังทำงาน!</strong><br><span style=\"color:#ef4444;font-size:14px;\">ลดลงปัจจุบัน: {bonusPct}%</span> — ฝากตอนนี้เพื่อรับโบนัส USDT พิเศษ!',\n`
);

// Update banner code
appJs = appJs.replace(
  "bearBanner.innerHTML = `📉 <strong>하락장 보상 이벤트 진행중!</strong><br><span style=\"color:#ef4444;font-size:14px;\">현재 하락률 ${bonusPct.toFixed(2)}%</span> 만큼 입금 시 USDT 보너스가 추가 지급됩니다!`;",
  "bearBanner.innerHTML = (t('bearMarketBanner') || '').replace('{bonusPct}', bonusPct.toFixed(2));"
);

// Update bubble code
appJs = appJs.replace(
  "existingBubble.innerHTML = `${bonusPct}% 추가 지급 진행중!!`;",
  "existingBubble.innerHTML = `${bonusPct}${t('bearMarketBubble')}`;"
);

fs.writeFileSync('public/static/app.js', appJs);
console.log('Translations patched successfully.');
