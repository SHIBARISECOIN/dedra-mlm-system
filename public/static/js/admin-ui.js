/**
 * admin-ui.js
 * 거대한 admin.html에서 분리된 첫 번째 UI 전용 모듈
 * 알림창(Toast), 모달(Modal), 로딩 스피너 등 전역 UI 유틸리티를 독립적으로 관리합니다.
 */

// 1. 알림 토스트 (Toast)
window.showToast = function(msg, type = 'default') {
    let toast = document.getElementById('adminToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'adminToast';
        toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(0);padding:12px 24px;border-radius:24px;font-size:14px;z-index:9999;transition:opacity .3s,transform .3s;pointer-events:none;max-width:90vw;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.25);';
        document.body.appendChild(toast);
    }
    const colors = {
        success: 'background:linear-gradient(135deg,#10b981,#059669);color:#fff;',
        error:   'background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;',
        warning: 'background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;',
        info:    'background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;',
        default: 'background:rgba(30,30,30,.92);color:#fff;'
    };
    toast.style.cssText += colors[type] || colors.default;
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
};

// 2. 모달 열기/닫기 (Modal)
window.openModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
};

window.closeModal = function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
};

// 3. 인라인 경고/성공 알림 (BcAlert)
window.showBcAlert = function(element, type, message) {
    if (!element) return;
    if (!message) {
        element.style.display = 'none';
        return;
    }
    
    element.style.display = 'block';
    element.style.padding = '12px 16px';
    element.style.borderRadius = '8px';
    element.style.marginBottom = '15px';
    element.style.fontSize = '13px';
    element.style.fontWeight = '500';
    
    if (type === 'success') {
        element.style.backgroundColor = '#ecfdf5';
        element.style.color = '#065f46';
        element.style.border = '1px solid #a7f3d0';
    } else if (type === 'error' || type === 'danger') {
        element.style.backgroundColor = '#fef2f2';
        element.style.color = '#991b1b';
        element.style.border = '1px solid #fecaca';
    } else if (type === 'warning') {
        element.style.backgroundColor = '#fffbeb';
        element.style.color = '#92400e';
        element.style.border = '1px solid #fde68a';
    } else {
        element.style.backgroundColor = '#eff6ff';
        element.style.color = '#1e40af';
        element.style.border = '1px solid #bfdbfe';
    }
    
    element.innerHTML = message;
};

// 4. 로딩 및 빈 화면 상태 UI
window.loading = function() { 
    return '<div class="loading"><div class="spinner"></div><div>로딩 중...</div></div>'; 
};

window.emptyState = function(msg) { 
    return \`<div class="empty-state"><div class="empty-icon">📭</div>\${msg}</div>\`; 
};

window.infoRow = function(label, value) {
    return \`<div class="info-row"><span class="info-label">\${label}</span><span class="info-value">\${value}</span></div>\`;
};

window.infoRow2 = function(label, value) {
    return \`<div style="display:flex;align-items:flex-start;padding:9px 14px;border-bottom:1px solid #f1f5f9;">
      <span style="font-size:12px;color:#64748b;min-width:110px;font-weight:600;padding-top:1px;">\${label}</span>
      <span style="font-size:13px;color:#1e293b;flex:1;word-break:break-word;">\${value}</span>
    </div>\`;
};

window.showInlineAlert = function(id, type, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!msg) { el.classList.remove('show'); return; }
    el.className = \`inline-alert inline-alert-\${type} show\`;
    el.textContent = msg;
};

// 5. 날짜 및 텍스트 포맷 (이 부분이 아까 수동 입금 로그 에러의 원인 중 하나였습니다)
window.fmtDate = function(ts) {
    if (!ts) return '-';
    // Timestamp 객체이거나 getTime()이 있는 Date, 혹은 millisecond 숫자
    if (ts.toDate) {
        return ts.toDate().toLocaleString('ko-KR');
    } else if (ts.seconds) {
        return new Date(ts.seconds * 1000).toLocaleString('ko-KR');
    } else {
        return new Date(ts).toLocaleString('ko-KR');
    }
};

window.fmtStatus = function(s) {
    return {
        pending: '대기중', processing: '처리중', approved: '승인됨', 
        rejected: '거부됨', held: '보류됨', failed: '실패됨'
    }[s] || s;
};

window.fmtDateFile = function() {
    const d = new Date();
    return \`\${d.getFullYear()}\${String(d.getMonth()+1).padStart(2,'0')}\${String(d.getDate()).padStart(2,'0')}\`;
};

console.log('✅ admin-ui.js loaded successfully. Safe UI functions are now globally available.');
