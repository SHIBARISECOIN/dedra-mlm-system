const fs = require('fs');
const path = '/home/user/webapp/public/static/admin.html';
let code = fs.readFileSync(path, 'utf-8');

// 1. In member update logic, set manualRankSet if rank changed from current member's rank.
const oldUpdate = `        const updates = {
            name:         document.getElementById('me_name').value.trim(),
            phone:        document.getElementById('me_phone').value.trim(),
            country:      document.getElementById('me_country').value.trim(),
            username:     document.getElementById('me_referralCode').value.trim(),
            referralCode: document.getElementById('me_referralCode').value.trim(),
            referredBy:   document.getElementById('me_referredBy').value.trim(),
            adminMemo:    document.getElementById('me_memo').value.trim(),
            status:       document.getElementById('me_status').value,
            rank:         document.getElementById('rankSelect').value,
        };`;

const newUpdate = `        const rankValue = document.getElementById('rankSelect').value;
        const updates = {
            name:         document.getElementById('me_name').value.trim(),
            phone:        document.getElementById('me_phone').value.trim(),
            country:      document.getElementById('me_country').value.trim(),
            username:     document.getElementById('me_referralCode').value.trim(),
            referralCode: document.getElementById('me_referralCode').value.trim(),
            referredBy:   document.getElementById('me_referredBy').value.trim(),
            adminMemo:    document.getElementById('me_memo').value.trim(),
            status:       document.getElementById('me_status').value,
            rank:         rankValue,
        };
        // 관리자가 직급을 직접 변경한 경우 자동 승격에서 제외
        if (currentMember.rank && currentMember.rank !== rankValue) {
            updates.manualRankSet = true;
        }`;

code = code.replace(oldUpdate, newUpdate);

// 2. Add 'runRankAllClearBtn'
const oldButtons = `<button class="btn btn-primary btn-sm" id="runAutoUpgradeBtn">⚡ 자동 승격 실행</button>`;
const newButtons = `<button class="btn btn-danger btn-sm" id="runRankAllClearBtn" style="margin-right:8px;">⚠️ 전직원 직급 초기화 및 재심사</button>
        <button class="btn btn-primary btn-sm" id="runAutoUpgradeBtn">⚡ 자동 승격 실행</button>`;

code = code.replace(oldButtons, newButtons);

// 3. Add listener for 'runRankAllClearBtn'
const oldListeners = `    document.getElementById('runAutoUpgradeBtn').onclick = async () => {`;
const newListeners = `    document.getElementById('runRankAllClearBtn').onclick = async () => {
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
    };

    document.getElementById('runAutoUpgradeBtn').onclick = async () => {`;

code = code.replace(oldListeners, newListeners);

// 4. Also add a manual exception toggle in the member edit modal
const oldModalRank = `<div class="fm-group">
            <label class="fm-label">직급 (Rank)</label>
            <select class="fm-input" id="rankSelect">`;
            
const newModalRank = `<div class="fm-group">
            <label class="fm-label">직급 (Rank) <span id="manualRankBadge" style="display:none; color:#ef4444; font-size:11px; margin-left:4px;">(자동승격 제외됨)</span></label>
            <select class="fm-input" id="rankSelect">`;

code = code.replace(oldModalRank, newModalRank);

// Find loadMemberDetail to populate the badge
const oldLoadMember = `        document.getElementById('rankSelect').value = m.rank || 'G0';`;
const newLoadMember = `        document.getElementById('rankSelect').value = m.rank || 'G0';
        document.getElementById('manualRankBadge').style.display = m.manualRankSet ? 'inline-block' : 'none';`;

code = code.replace(oldLoadMember, newLoadMember);

fs.writeFileSync(path, code);
console.log('admin.html patched successfully');
