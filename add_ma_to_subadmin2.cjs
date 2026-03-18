const fs = require('fs');

let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');

const oldSub = `  { key:'withdrawals', label:'💸 출금 관리' },`;
const newSub = `  { key:'withdrawals', label:'💸 출금 관리' },
  { key:'bonus',       label:'🎁 보너스 지급' },
  { key:'manualAdjust',label:'✍️ 임의 입금 관리' },`;

if (adminHtml.includes(oldSub) && !adminHtml.includes("key:'manualAdjust'")) {
    adminHtml = adminHtml.replace(oldSub, newSub);
    fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
    console.log('Added manualAdjust to SUB_ADMIN_MENUS');
} else {
    console.log('Already there or could not find.');
}
