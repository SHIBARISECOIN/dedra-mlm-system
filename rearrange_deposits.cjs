const fs = require('fs');

let html = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

// 1. Extract Company Wallet Card
const walletStartMarker = '      <!-- ── 회사 입금 지갑 주소 설정 카드 ── -->';
const walletEndMarker = '      </div><!-- /card -->';

const wStartIdx = html.indexOf(walletStartMarker);
let wEndIdx = html.indexOf(walletEndMarker, wStartIdx);
if (wEndIdx !== -1) {
  wEndIdx += walletEndMarker.length;
}

const walletBlock = html.substring(wStartIdx, wEndIdx);
// Remove walletBlock from original position
html = html.substring(0, wStartIdx) + html.substring(wEndIdx);

// 2. Extract Deposit List Card
const depListStartMarker = '      <!-- ── 입금 신청 목록 ── -->';
const depListEndMarker = '        <div id="depositsTableWrap"></div>\n      </div>';

const dlStartIdx = html.indexOf(depListStartMarker);
let dlEndIdx = html.indexOf(depListEndMarker, dlStartIdx);
if (dlEndIdx !== -1) {
  dlEndIdx += depListEndMarker.length;
}

const depListBlock = html.substring(dlStartIdx, dlEndIdx);
// Remove depListBlock from original position
html = html.substring(0, dlStartIdx) + html.substring(dlEndIdx);

// 3. Modify Header and Insert Deposit List Card right after Header
const headerMarker = `<div id="depositsPage" class="page">
      <div class="page-title">입금 관리</div>
      <div class="page-desc">회원 입금 신청을 확인하고 승인/거부하세요</div>`;

const newHeader = `<div id="depositsPage" class="page">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px;">
        <div>
          <div class="page-title" style="margin-bottom:4px;">입금 관리</div>
          <div class="page-desc" style="margin-bottom:0;">회원 입금 신청을 확인하고 승인/거부하세요</div>
        </div>
        <button onclick="document.getElementById('companyWalletModal').style.display='flex'" class="btn" style="background:#fff;border:1.5px solid #e2e8f0;color:#64748b;font-weight:700;display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;font-size:13px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.05);transition:all 0.2s;">
          <span style="font-size:16px;">🏦</span> 지갑 설정
        </button>
      </div>

${depListBlock}
<div style="height: 24px;"></div>
`;

html = html.replace(headerMarker, newHeader);

// 4. Create Modal for Wallet Settings
const modalHtml = `
    <!-- ── 회사 입금 지갑 설정 모달 ── -->
    <div id="companyWalletModal" class="modal-overlay" style="display:none; align-items:center; justify-content:center; padding:20px;">
      <div class="modal-content" style="max-width:700px; width:100%; max-height:90vh; overflow-y:auto; padding:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:20px 24px; border-bottom:1px solid #e2e8f0; position:sticky; top:0; background:#fff; z-index:10;">
          <h3 style="margin:0; font-size:18px; font-weight:800; display:flex; align-items:center; gap:8px;">
            <span style="font-size:20px;">🏦</span> 회사 입금 지갑 주소 설정
          </h3>
          <button onclick="document.getElementById('companyWalletModal').style.display='none'" style="background:none; border:none; font-size:24px; color:#94a3b8; cursor:pointer;">&times;</button>
        </div>
        <div style="padding:20px 24px;">
          <div style="display:flex; gap:8px; margin-bottom: 20px;">
            <button class="btn btn-gray btn-sm" id="modalReloadWalletsBtn" onclick="document.getElementById('reloadWalletsBtn').click()" style="flex:1;">↩ 다시 불러오기</button>
            <button class="btn btn-primary btn-sm" id="modalSaveWalletsBtn" onclick="document.getElementById('saveWalletsBtn').click()" style="flex:2;">💾 설정 저장</button>
          </div>
          <!-- 원래 컨텐츠 삽입 -->
          <div id="walletSettingsOriginalContent">
${walletBlock.replace('class="card"', 'class=""').replace('margin-bottom:20px;', '').replace(/<div class="card-header">[\s\S]*?<\/div>(\s*<div style="padding:20px 24px;">)/, '$1')}
          </div>
        </div>
      </div>
    </div>
`;

// Insert modal before </body>
html = html.replace('</body>', modalHtml + '\n</body>');

fs.writeFileSync('/home/user/webapp/public/static/admin.html', html);
console.log('Successfully rearranged deposits page!');
