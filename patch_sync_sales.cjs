const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

// 1) submitReinvest (around line 5679)
code = code.replace(
  /await batch\.commit\(\);\s*\/\/\s*---\s*잭팟 로직 추가\s*---/,
  "await batch.commit();\n\n    // 🔄 산하 매출 즉시 동기화\n    fetch('/api/admin/sync-sales').catch(e => console.log('sync error', e));\n\n    // --- 잭팟 로직 추가 ---"
);

// 2) releaseInvestment (around line 6130)
code = code.replace(
  /await batch\.commit\(\);\s*\/\/\s*만기 알림 생성/,
  "await batch.commit();\n      // 🔄 산하 매출 즉시 동기화\n      fetch('/api/admin/sync-sales').catch(e => console.log('sync error', e));\n\n      // 만기 알림 생성"
);

// 3) submitInvestment (around line 6329)
code = code.replace(
  /await batch\.commit\(\);\s*\/\/\s*로컬 walletData도 즉시 반영/,
  "await batch.commit();\n\n    // 🔄 산하 매출 즉시 동기화\n    fetch('/api/admin/sync-sales').catch(e => console.log('sync error', e));\n\n    // 로컬 walletData도 즉시 반영"
);

fs.writeFileSync('public/static/app.js', code);
console.log('Patched app.js with sync-sales triggers');
