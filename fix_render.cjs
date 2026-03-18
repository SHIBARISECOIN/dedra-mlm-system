const fs = require('fs');
let appJs = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

appJs = appJs.replace(
  /details = \`만기: \$\{item\.durationDays\}일 \(\$\{item\.dailyRate\}%\/일\)\`;/g,
  "details = `만기: ${item.durationDays || 360}일 (${item.dailyRate || item.roiPercent || item.dailyRoi || 0.8}%/일) - ${item.status==='active'?'진행중':'종료'}`;"
);

fs.writeFileSync('/home/user/webapp/public/static/app.js', appJs);
console.log("Fixed render for investments.");
