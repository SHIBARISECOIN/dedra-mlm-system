const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

code = code.replace(
  /📅 만기일: \$\{getDaysLaterStr\(selectedProduct\.days\)\}<br>\s*🔒 원금은 만기 후 언프리즈 가능합니다\./,
  `📅 \${t('maturityDate') || '만기일'}: \${getDaysLaterStr(selectedProduct.days)}<br>
    🔒 \${t('productHint2') || '만기 후 언프리즈 가능합니다.'}`
);

fs.writeFileSync('public/static/app.js', code);
console.log('Patched Preview UI strings.');
