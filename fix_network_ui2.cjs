const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// Replace "데일리" with "당일 수익"
appJs = appJs.replace(/<div style="font-size:9px;color:var\(--text3,#64748b\);font-weight:600;text-align:right;">데일리<\/div>/g, 
  '<div style="font-size:9px;color:var(--text3,#64748b);font-weight:600;text-align:right;">당일 수익</div>');

// Ensure that "총 매출" is used
appJs = appJs.replace(/<div style="font-size:9px;color:var\(--text3,#64748b\);font-weight:600;text-align:right;">총 합계<\/div>/g, 
  '<div style="font-size:9px;color:var(--text3,#64748b);font-weight:600;text-align:right;">총 매출</div>');

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Headers updated.");
