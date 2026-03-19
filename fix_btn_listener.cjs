const fs = require('fs');
const path = '/home/user/webapp/public/static/admin.html';
let code = fs.readFileSync(path, 'utf-8');

const oldCode = `    // ── 직급 승격 자동 실행 ──
    document.getElementById('runAutoUpgradeBtn').addEventListener('click', async () => {`;

const newCode = `    // ── 직급 초기화 및 재심사 ──
    document.getElementById('runRankAllClearBtn').addEventListener('click', async () => {
        if (!await _adminConfirm('정말 모든 회원의 직급을 G0으로 강등한 후 (수동 설정자 제외) 다시 심사하시겠습니까?\\n\\n이 작업은 되돌릴 수 없습니다.', '⚠️')) return;
        const btn = document.getElementById('runRankAllClearBtn');
        btn.disabled = true; btn.textContent = '실행 중...';
        showToast('초기화 및 재심사를 시작합니다. 잠시만 기다려주세요...', 'info');
        const res = await api.runRankAllClear(currentAdmin.uid);
        if (res.success) {
            showToast('✅ ' + res.data, 'success');
            await loadRankMonitorPage(); // 새로고침
        } else {
            showToast('❌ 실패: ' + res.error, 'error');
        }
        btn.disabled = false; btn.textContent = '⚠️ 전직원 직급 초기화 및 재심사';
    });

    // ── 직급 승격 자동 실행 ──
    document.getElementById('runAutoUpgradeBtn').addEventListener('click', async () => {`;

if (code.includes(oldCode)) {
    code = code.replace(oldCode, newCode);
    fs.writeFileSync(path, code);
    console.log('Button listener fixed!');
} else {
    console.log('Could not find the target code to replace.');
}
