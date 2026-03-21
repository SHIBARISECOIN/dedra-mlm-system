const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public/static/app.js');
let js = fs.readFileSync(appJsPath, 'utf8');

// The problematic code is around:
/*
  loadTxHistory(type);
};




  }
});

// ===== 입금 신청 =====
*/

js = js.replace(/loadTxHistory\(type\);\n\};\n\n\n\n\n  \}\n\}\);\n\n\/\/ ===== 입금 신청 =====/, "loadTxHistory(type);\n};\n\n// ===== 입금 신청 =====");

fs.writeFileSync(appJsPath, js);
console.log('Syntax error fixed');
