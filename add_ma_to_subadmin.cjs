const fs = require('fs');

let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');
const target = "{ key:'bonus',       label:'🎁 보너스 지급' },";
const replacement = "{ key:'bonus',       label:'🎁 보너스 지급' },\n  { key:'manualAdjust',label:'✍️ 임의 입금 관리' },";

// It seems 'bonus' wasn't even in SUB_ADMIN_MENUS? Let's check SUB_ADMIN_MENUS.
