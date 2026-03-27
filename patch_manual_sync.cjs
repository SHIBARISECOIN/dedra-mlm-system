const fs = require('fs');
let code = fs.readFileSync('manual_sync.cjs', 'utf8');

code = code.replace(
  /walletMap\[d\.id\]\s*=\s*d\.data\(\)\.totalInvested\s*\|\|\s*d\.data\(\)\.totalInvest\s*\|\|\s*0;/,
  "walletMap[d.id] = (d.data().totalInvest !== undefined ? d.data().totalInvest : d.data().totalInvested) || 0;"
);

fs.writeFileSync('manual_sync.cjs', code);
console.log('Patched manual_sync.cjs');
