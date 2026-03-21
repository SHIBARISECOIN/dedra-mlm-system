const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<div class="tx-amount ${amtColor}">${amtSign}${fmt(item.amount)} ${item.currency || \'USDT\'}</div>',
  '<div class="tx-amount ${amtColor}">${amtSign}${fmt(item.amountUsdt !== undefined ? item.amountUsdt : item.amount)} ${item.currency || \'USDT\'}</div>'
);

fs.writeFileSync(file, content);
console.log("Patched app.js amountUsdt");
