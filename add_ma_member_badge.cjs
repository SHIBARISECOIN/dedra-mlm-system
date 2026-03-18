const fs = require('fs');

let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');

// The line we want to replace is around 7230:
// document.getElementById('me_headerName').textContent  = name;
const oldStr = `document.getElementById('me_headerName').textContent  = name;`;
const newStr = `document.getElementById('me_headerName').innerHTML = name + (currentMember.hasManualDeposit ? ' <span style="background:#ef4444;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;vertical-align:middle;">⚠️ 임의입금 주의</span>' : '');`;

if (adminHtml.includes(oldStr)) {
    adminHtml = adminHtml.replace(oldStr, newStr);
    fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
    console.log('Modified me_headerName for manual adjust warning.');
} else {
    console.log('Could not find target string in admin.html');
}
