const fs = require('fs');

// Fix app.js
const appFile = '/home/user/webapp/public/static/app.js';
let app = fs.readFileSync(appFile, 'utf8');

app = app.replace(
  "setEl('splitBonusDdra',      '≈ $' + fmt(bonus) + ' USDT');",
  "setEl('splitBonusDdra',      '≈ ' + fmt(withdrawableDdra) + ' DDRA');"
);

// Add "Available USDT" into translations
app = app.replace(
  "withdrawableUsdt: '출금 가능 USDT',",
  "withdrawableUsdt: 'Available USDT',"
);

// We need to also patch the korean translations so they stay or change. Wait, the user said "위에 Withdrawal USDT라고 되어 있는 부분, USDT라고 적지 마세요.Available USDT이렇게 적어줘." meaning "Do not write USDT for the Withdrawal USDT part, write Available USDT like this."
// Wait, they probably want "Available USDT" literally, for both languages? Or just for English? Let's write "Available USDT" for all languages to be safe, or check existing translations.
// Let's replace the string in index.html as well.

fs.writeFileSync(appFile, app, 'utf8');
console.log("app.js patched");

// Fix index.html
const indexFile = '/home/user/webapp/public/index.html';
let idx = fs.readFileSync(indexFile, 'utf8');

idx = idx.replace(
  '<div class="asset-split-label" style="color:#f59e0b;font-weight:600;" data-i18n="withdrawableUsdt">출금 가능 USDT</div>',
  '<div class="asset-split-label" style="color:#f59e0b;font-weight:600;" data-i18n="withdrawableUsdt">Available USDT</div>'
);

fs.writeFileSync(indexFile, idx, 'utf8');
console.log("index.html patched");

