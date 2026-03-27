const fs = require('fs');
let code = fs.readFileSync('public/static/app.js', 'utf8');

const listenerCode = `
    // --- 시스템 유지보수(정산) 감지 리스너 ---
    if (!window._systemUnsubscribe) {
      window._systemUnsubscribe = window.FB.onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
        if (docSnap.exists()) {
          const sys = docSnap.data();
          if (sys.maintenanceMode) {
            showMaintenanceModal(sys.maintenanceMessage);
          } else {
            hideMaintenanceModal();
          }
        }
      });
    }
`;

const modalCode = `
window.showMaintenanceModal = function(msg) {
  if (userData && userData.role === 'admin') return; // 관리자는 패스
  let m = document.getElementById('maintenanceOverlay');
  if (!m) {
    m = document.createElement('div');
    m.id = 'maintenanceOverlay';
    m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.95);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;animation:fadeIn 0.3s ease;';
    
    m.innerHTML = \`
      <div style="background:#1e293b;border:1px solid #334155;border-radius:24px;padding:40px 24px;text-align:center;width:100%;max-width:400px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <div style="font-size:48px;margin-bottom:20px;animation:bounce 2s infinite;">🛠️</div>
        <h2 style="color:#f8fafc;font-size:22px;font-weight:800;margin-bottom:12px;letter-spacing:-0.5px;">시스템 점검 및 정산 중</h2>
        <div id="maintenanceMessage" style="color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:24px;word-break:keep-all;">
          현재 안정적인 서비스 제공과 정확한 수익 정산을 위해<br>시스템 동기화 작업을 진행하고 있습니다.
        </div>
        <div style="display:flex;justify-content:center;gap:8px;">
          <div class="dot" style="width:8px;height:8px;background:#6366f1;border-radius:50%;animation:pulse 1.5s infinite"></div>
          <div class="dot" style="width:8px;height:8px;background:#6366f1;border-radius:50%;animation:pulse 1.5s infinite 0.2s"></div>
          <div class="dot" style="width:8px;height:8px;background:#6366f1;border-radius:50%;animation:pulse 1.5s infinite 0.4s"></div>
        </div>
      </div>
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bounce { 0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: translateY(0); animation-timing-function: cubic-bezier(0,0,0.2,1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(0.8); } }
      </style>
    \`;
    document.body.appendChild(m);
  }
  const msgEl = document.getElementById('maintenanceMessage');
  if (msgEl) {
    msgEl.innerHTML = msg || '현재 안정적인 서비스 제공과 정확한 수익 정산을 위해<br>시스템 동기화 작업을 진행하고 있습니다.<br><br><span style="color:#ef4444;font-size:13px;">작업 중에는 접속이 제한되오니 조금만 기다려주세요.</span>';
  }
};

window.hideMaintenanceModal = function() {
  const m = document.getElementById('maintenanceOverlay');
  if (m) m.remove();
};
`;

if (!code.includes('showMaintenanceModal')) {
  code = code + '\n' + modalCode;
  code = code.replace("window._userUnsubscribe = window.FB.onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {", listenerCode + "\n    window._userUnsubscribe = window.FB.onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {");
  fs.writeFileSync('public/static/app.js', code);
  console.log("App patch success");
} else {
  console.log("App already patched");
}
