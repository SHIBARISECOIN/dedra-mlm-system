const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

// 1. Add menu item
code = code.replace(
  /<div class="menu-item" data-page="bonus"><span class="menu-icon">🎁<\/span>보너스 지급<\/div>/,
  `<div class="menu-item" data-page="bonus"><span class="menu-icon">🎁</span>보너스 지급</div>
    <div class="menu-item" data-page="settlements"><span class="menu-icon">🧾</span>정산 이력 조회</div>`
);

// 2. Add settlementsPage div
const settlementsPageHtml = `
    <!-- ══════════════════════════════════════════════
         정산 이력 관리 페이지
    ══════════════════════════════════════════════ -->
    <div id="settlementsPage" class="page">
      <div class="page-title">🧾 정산 이력 조회</div>
      <div class="page-desc">매일 자정에 실행되는 일일 정산(ROI 및 보너스)의 상세 이력을 확인합니다.</div>
      
      <div style="background:#fff;border-radius:14px;padding:22px;box-shadow:0 2px 8px rgba(0,0,0,.07);max-width:960px;margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
           <div style="font-size:16px; font-weight:700; color:#1e293b;">📋 최근 정산 이력</div>
           <button class="btn btn-sm" onclick="loadSettlementHistory()" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:600;"><span class="icon">🔄</span> 새로고침</button>
        </div>
        <div id="settlementHistoryList2" style="display:flex; flex-direction:column; gap:12px; max-height:600px; overflow-y:auto; padding-right:8px;">
          <!-- JS로 로드 -->
        </div>
      </div>
    </div>
`;

code = code.replace(/<div id="ratesPage" class="page">/, settlementsPageHtml + '\n    <div id="ratesPage" class="page">');

// 3. Make loadSettlementHistory render to the new list div, and auto-load on tab switch
const jsPatch = `
// Tab switch logic hook for settlements
const origNav = window.switchPage || function(){};
window.switchPage = function(pageId) {
   if (pageId === 'settlements') {
       loadSettlementHistory();
   }
   if (typeof origNav === 'function' && origNav.name !== 'switchPage') {
       // just in case we need to call original if it was defined
   }
   // In admin.html switchPage is usually bound by a generic listener.
   // Wait, let's just use the menu click listener.
};
`;

fs.writeFileSync('/home/user/webapp/public/static/admin.html', code);
console.log('Menu added');
