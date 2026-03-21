const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'public/index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Replace forcePwModal styles to be super explicit about clicks
html = html.replace(
  '<div id="forcePwModal" style="display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);align-items:center;justify-content:center;">',
  '<div id="forcePwModal" style="display:none;position:fixed;inset:0;z-index:99999999;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);align-items:center;justify-content:center;pointer-events:auto !important;user-select:auto !important;">'
);

html = html.replace(
  'id="forcePwNew" placeholder="새로운 비밀번호 입력 (6자리 이상)" style="width:100%;',
  'id="forcePwNew" placeholder="새로운 비밀번호 입력 (6자리 이상)" style="pointer-events:auto !important;user-select:auto !important;width:100%;'
);

html = html.replace(
  'id="forcePwConfirm" placeholder="다시 한번 입력해 주세요" style="width:100%;',
  'id="forcePwConfirm" placeholder="다시 한번 입력해 주세요" style="pointer-events:auto !important;user-select:auto !important;width:100%;'
);

fs.writeFileSync(indexHtmlPath, html);
console.log('Fixed modal CSS in index.html');
