const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

code = code.replace(
  "console.error('[announcements] load error:', err);",
  "console.error('[announcements] load error:', err);\n    if (err && err.code) { document.getElementById('announcementList').innerHTML = `<div class=\"empty-state\" style=\"color:red\">${err.message}</div>`; return; }"
);

code = code.replace(
  "console.error('[EARN] 상품 로드 오류:', e);",
  "console.error('[EARN] 상품 로드 오류:', e);\n    if (e && e.code) { listEl.innerHTML = `<div style=\"font-size:11px;color:red;text-align:center;padding:12px 0;\">Error: ${e.message}</div>`; return; }"
);

fs.writeFileSync('public/static/app.js', code);
