const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

const jsPatch = `
    const syncSalesBtn = document.getElementById('syncSalesBtn');
    const orgTreeSyncSalesBtn = document.getElementById('orgTreeSyncSalesBtn');
    
    const doSyncSales = async (btn) => {
        if (!await _adminConfirm('전체 회원의 본인매출 및 라인매출 데이터를 동기화합니다.\\n계속하시겠습니까?')) return;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = '처리 중...';
        try {
            const r = await api.updateAllSalesStats(currentAdmin.uid);
            if (r.success) {
                alert(\`✅ 매출 동기화 완료: \${r.data.updatedCount}명 업데이트됨\`);
                // reload current org tree if in orgTree page
                if (window.adminCavePath && window.adminCavePath.length > 0) {
                    loadOrgTree(window.adminCavePath[0].id);
                }
            } else {
                alert(\`❌ 오류: \${r.error}\`);
            }
        } catch(e) {
            alert(\`❌ 예외 발생: \${e.message}\`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };

    if (syncSalesBtn) syncSalesBtn.onclick = () => doSyncSales(syncSalesBtn);
    if (orgTreeSyncSalesBtn) orgTreeSyncSalesBtn.onclick = () => doSyncSales(orgTreeSyncSalesBtn);
`;

code = code.replace(
  /const syncSalesBtn = document\.getElementById\('syncSalesBtn'\);[\s\S]*?(?=\/\/ ── 전체 직급 재계산 버튼 ──)/,
  jsPatch + '\n\n    '
);

fs.writeFileSync('/home/user/webapp/public/static/admin.html', code);
console.log('Patched JS logic');
