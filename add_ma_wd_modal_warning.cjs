const fs = require('fs');

let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');

const oldCode = `    // 회원 정보
    let memberName = currentTx.userId, memberPhone = '';
    try {
        const userSnap = await getDoc(doc(db,'users',currentTx.userId));
        if (userSnap.exists()) {
            const ud = userSnap.data();
            memberName  = ud.name  || memberName;
            memberPhone = ud.phone || '';
        }
    } catch(e) {}`;

const newCode = `    // 회원 정보
    let memberName = currentTx.userId, memberPhone = '', hasMa = false;
    try {
        const userSnap = await getDoc(doc(db,'users',currentTx.userId));
        if (userSnap.exists()) {
            const ud = userSnap.data();
            memberName  = ud.name  || memberName;
            memberPhone = ud.phone || '';
            hasMa = ud.hasManualDeposit === true;
        }
    } catch(e) {}`;

if (adminHtml.includes(oldCode)) {
    adminHtml = adminHtml.replace(oldCode, newCode);
    
    const oldTitleCode = `    const subEl = document.getElementById('wdModalSubtitle');
    if (subEl) subEl.textContent = memberName + ' • ' + fmtDate(currentTx.createdAt);`;
    
    const newTitleCode = `    const subEl = document.getElementById('wdModalSubtitle');
    if (subEl) {
        subEl.innerHTML = memberName + ' • ' + fmtDate(currentTx.createdAt) + 
            (hasMa ? ' <span style="background:#ef4444;color:#fff;font-size:10px;padding:2px 4px;border-radius:4px;margin-left:4px;">⚠️ 임의입금 주의</span>' : '');
    }`;
    
    adminHtml = adminHtml.replace(oldTitleCode, newTitleCode);
    fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
    console.log('Modified showWithdrawalDetail for manual adjust warning.');
} else {
    console.log('Could not find target string in admin.html');
}
