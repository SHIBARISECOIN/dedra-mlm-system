const fs = require('fs');
const appFile = '/home/user/webapp/public/static/app.js';
let app = fs.readFileSync(appFile, 'utf8');

// Insert withdrawableUsdt in every translation block
app = app.replace(
  /withdrawableDdra: '출금 가능 DDRA',/g,
  "withdrawableUsdt: 'Available USDT',\n    withdrawableDdra: '출금 가능 DDRA',"
);
app = app.replace(
  /withdrawableDdra: 'Withdrawable DDRA',/g,
  "withdrawableUsdt: 'Available USDT',\n    withdrawableDdra: 'Withdrawable DDRA',"
);
app = app.replace(
  /withdrawableDdra: 'DDRA có thể rút',/g,
  "withdrawableUsdt: 'Available USDT',\n    withdrawableDdra: 'DDRA có thể rút',"
);
app = app.replace(
  /withdrawableDdra: 'DDRA Có thể rút',/g,
  "withdrawableUsdt: 'Available USDT',\n    withdrawableDdra: 'DDRA Có thể rút',"
);
app = app.replace(
  /withdrawableDdra: 'DDRA ที่ถอนได้',/g,
  "withdrawableUsdt: 'Available USDT',\n    withdrawableDdra: 'DDRA ที่ถอนได้',"
);

fs.writeFileSync(appFile, app, 'utf8');
console.log("Translations added.");
