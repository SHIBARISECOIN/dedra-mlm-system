const fs = require('fs');
let appJs = fs.readFileSync('public/static/app.js', 'utf8');

appJs = appJs.replace(
  /typeDeposit: 'Nạp',\n/g,
  `typeDeposit: 'Nạp',\n    bearMarketBubble: '% Thưởng thêm đang diễn ra!!',\n    bearMarketBanner: '📉 <strong>Sự kiện bù đắp thị trường gấu đang diễn ra!</strong><br><span style=\"color:#ef4444;font-size:14px;\">Mức giảm hiện tại: {bonusPct}%</span> — Nạp ngay để nhận thưởng USDT tương đương!',\n`
);

fs.writeFileSync('public/static/app.js', appJs);
console.log('Vi translated');
