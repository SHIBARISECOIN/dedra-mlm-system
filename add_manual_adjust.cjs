const fs = require('fs');

let adminHtml = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf-8');

// Add menu item
const menuTarget = '<div class="menu-item" data-page="bonus"><span class="menu-icon">🎁</span>보너스 지급</div>';
if (!adminHtml.includes('data-page="manualAdjust"')) {
    adminHtml = adminHtml.replace(
        menuTarget,
        menuTarget + '\n    <div class="menu-item" data-page="manualAdjust"><span class="menu-icon">✍️</span>임의 입금 관리</div>'
    );
}

// Add page
const pageTarget = '<div id="noticesPage" class="page">';
const manualAdjustPage = `
    <!-- ══════════════════════════════
         임의 입금 관리
    ══════════════════════════════ -->
    <div id="manualAdjustPage" class="page">
      <div class="page-title">임의 입금/차감 관리</div>
      <div class="page-desc">영업/마케팅 목적으로 회원에게 코인(USDT/보너스/등)을 임의로 지급하거나 회수합니다. 이 내역은 출금 신청 시 경고로 표시됩니다.</div>

      <div class="card">
        <div class="card-header"><span class="card-title">✍️ 임의 조정 실행</span></div>
        <div style="padding:24px;">
          <div id="maAlert" class="inline-alert"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label">회원 ID (UID 또는 이메일)</label>
              <input class="form-input" id="maUserId" placeholder="회원 아이디, 이메일, UID 입력">
            </div>
            <div class="form-group">
              <label class="form-label">조정 대상 지갑</label>
              <select class="form-input" id="maWalletType">
                <option value="usdtBalance">USDT 잔액</option>
                <option value="bonusBalance">보너스 잔액</option>
                <option value="lockedBalance">투자 (FREEZE) 금액</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div class="form-group">
              <label class="form-label">조정 금액 (+/-)</label>
              <div style="display:flex;gap:8px;">
                <select class="form-input" id="maSign" style="width:80px;font-weight:bold;">
                  <option value="add" style="color:blue;">+ 지급</option>
                  <option value="sub" style="color:red;">- 차감</option>
                </select>
                <input type="number" class="form-input" id="maAmount" placeholder="0.00" min="0.01" style="flex:1;">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">메모 / 사유</label>
              <input class="form-input" id="maReason" placeholder="예: 마케팅 특별 지원금">
            </div>
          </div>
          <button class="btn btn-primary" id="maSubmitBtn" onclick="window.submitManualAdjust()">🚀 임의 조정 실행</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 처리 내역</span>
          <button class="btn btn-gray btn-sm" onclick="window.loadManualAdjustLogs()">새로고침</button>
        </div>
        <div id="maLogWrap">
           <div class="empty-state">내역을 불러오는 중...</div>
        </div>
      </div>
    </div>

`;

if (!adminHtml.includes('id="manualAdjustPage"')) {
    adminHtml = adminHtml.replace(pageTarget, manualAdjustPage + pageTarget);
}

fs.writeFileSync('/home/user/webapp/public/static/admin.html', adminHtml);
console.log('Added manualAdjust UI');
