const fs = require('fs');
const file = '/home/user/webapp/public/static/app.js';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /<div style="font-size:11px;color:var\(--text2,#94a3b8\);margin-top:2px;">\$\{fmtDate\(tx.createdAt\)\}<\/div>/g,
  '<div style="font-size:11px;color:var(--text2,#94a3b8);margin-top:2px;">${tx.settlementDate || fmtDate(tx.createdAt)}</div>'
);

fs.writeFileSync(file, code);
console.log('Fixed fmtDate for bonuses');
