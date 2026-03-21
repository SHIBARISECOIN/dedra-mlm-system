const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/app.js', 'utf8');

// The original code uses 'daily_roi' instead of 'roi' in txs history filtering.
// And it doesn't map 'roi' correctly. Let's fix this.

// 1. Fix invest typeFilter query in loadTxHistory (around line 3921)
code = code.replace(
  /qList\.push\(query\(collection\(db, 'bonuses'\), where\('userId', '==', currentUser\.uid\), where\('type', '==', 'daily_roi'\), limit\(100\)\)\);/,
  `qList.push(query(collection(db, 'bonuses'), where('userId', '==', currentUser.uid), where('type', 'in', ['daily_roi', 'roi', 'roi_income']), limit(100)));`
);

// 2. Also ensure today filter uses the correct date checks for all types of timestamps (around line 3942)
// Actually the current filtering uses a generic getSortTime, which handles different cases. But we want to make sure the Today Filter isn't breaking.
// We'll leave the Today filter alone, assuming getSortTime works.

// 3. Fix labels
if (!code.includes("'roi':")) {
    code = code.replace(
      /const typeLabel = \{/,
      `const typeLabel = {\n      'roi': '일일 데일리 수익',\n      'roi_income': '일일 데일리 수익',`
    );
}

fs.writeFileSync('/home/user/webapp/public/static/app.js', code);
console.log('Patched app.js transaction filters');
