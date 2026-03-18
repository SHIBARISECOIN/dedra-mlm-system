const fs = require('fs');

let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');

// The line we want to replace is around 5635:
// <td><strong style="color:#2563eb;font-size:13px;">${formatUserLabel(r.userId, r.userEmail)}</strong></td>
const oldStr = '<td><strong style="color:#2563eb;font-size:13px;">${formatUserLabel(r.userId, r.userEmail)}</strong></td>';
const newStr = `<td>
                <strong style="color:#2563eb;font-size:13px;">\${formatUserLabel(r.userId, r.userEmail)}</strong>
                \${(window.globalUserCache[r.userId] && window.globalUserCache[r.userId].hasManualDeposit) ? '<div style="margin-top:4px;"><span style="background:#ef4444;color:#fff;font-size:10px;padding:2px 5px;border-radius:4px;box-shadow:0 2px 4px rgba(239,68,68,0.3);"><i class="fas fa-exclamation-triangle"></i> 임의입금 이력</span></div>' : ''}
              </td>`;

if (adminHtml.includes(oldStr)) {
    adminHtml = adminHtml.replace(oldStr, newStr);
    
    // Also add row highlighting if possible. The <tr> is mapped right before it.
    // return `<tr>
    const oldTr = 'return `<tr>';
    const newTr = 'const hasMa = (window.globalUserCache[r.userId] && window.globalUserCache[r.userId].hasManualDeposit);\n            return `<tr style="${hasMa ? \'background:rgba(239,68,68,0.05);\' : \'\'}">';
    adminHtml = adminHtml.replace(oldTr, newTr);
    
    fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
    console.log('Modified loadWithdrawals for manual adjust warning.');
} else {
    console.log('Could not find target string in admin.html');
}
