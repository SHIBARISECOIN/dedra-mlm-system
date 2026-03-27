const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

// Insert ko
code = code.replace(
  /perDay: '\/일',/,
  "perDay: '/일',\n    unit_days: '일',\n    totalEarnSuffix: '일 합계',"
);

// Insert en
code = code.replace(
  /perDay: '\/day',/,
  "perDay: '/day',\n    unit_days: ' days',\n    totalEarnSuffix: ' days total',"
);

// Insert vi
code = code.replace(
  /perDay: '\/ngày',/,
  "perDay: '/ngày',\n    unit_days: ' ngày',\n    totalEarnSuffix: ' ngày tổng cộng',"
);

// Insert th
code = code.replace(
  /perDay: '\/วัน',/,
  "perDay: '/วัน',\n    unit_days: ' วัน',\n    totalEarnSuffix: ' วันรวม',"
);

// Patch runSimulator
code = code.replace(
  /setEl\('simDays', days \+ '일'\);\s*setEl\('simRoi', roi \+ '%'\);\s*setEl\('simEarning', fmt\(earning\) \+ ' USDT\/일 \(' \+ fmt\(earningDdra\) \+ ' DDRA\)'\);\s*setEl\('simEarningUsd', fmt\(totalEarning\) \+ ' USDT \(' \+ days \+ '일 합계\)'\);/,
  `setEl('simDays', days + (t('unit_days') || '일'));
  setEl('simRoi', roi + '%');
  setEl('simEarning', fmt(earning) + ' USDT' + (t('perDay') || '/일') + ' (' + fmt(earningDdra) + ' DDRA)');
  setEl('simEarningUsd', fmt(totalEarning) + ' USDT (' + days + (t('totalEarnSuffix') || '일 합계') + ')');`
);

// Patch loadMyInvestments Expected Return
code = code.replace(
  /setEl\('expectedReturn', fmt\(sumItems\.returns\) \+ ' USDT\/일'\);/,
  `setEl('expectedReturn', fmt(sumItems.returns) + ' USDT' + (t('perDay') || '/일'));`
);

// Check if updateInvestPreview needs fix too
code = code.replace(
  /📌 일 수익: <strong style="color:var\(--green\)">\$\{fmt\(earning\)\} USDT<\/strong><br>\s*💡 DDRA 환산: ≈ \$\{fmt\(earningDdra\)\} DDRA\/일 \(1 DDRA = \$\$\{\(deedraPrice\|\|0\.5\)\.toFixed\(4\)\}\)<br>/,
  `📌 \${t('dailyReturnLabel') || '일 수익:'} <strong style="color:var(--green)">\${fmt(earning)} USDT</strong><br>
    💡 \${t('ddraConvert') || 'DDRA 환산'}: ≈ \${fmt(earningDdra)} DDRA\${t('perDay') || '/일'} (1 DDRA = $\${(deedraPrice||0.5).toFixed(4)})<br>`
);

fs.writeFileSync('public/static/app.js', code);
console.log('Patched Simulator & Expected Return UI strings.');
