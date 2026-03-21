const fs = require('fs');
const file = '/home/user/webapp/public/index.html';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div class="menu-section-title large" data-i18n="txHistory">📊 거래 내역<\/div>[\s\S]*?<div id="txHistoryList" class="tx-list">/;

const replacement = `<div class="menu-section-title large" data-i18n="txHistory">📊 거래 내역</div>
            <div class="tx-tabs" id="txTabsContainer" style="overflow-x:auto; white-space:nowrap; padding-bottom:4px;">
              <button class="tx-tab active" onclick="switchTxTab('deposit', this)">입금</button>
              <button class="tx-tab" onclick="switchTxTab('withdrawal', this)">출금</button>
              <button class="tx-tab" onclick="switchTxTab('roi', this)">FREEZE</button>
              <button class="tx-tab" onclick="switchTxTab('direct_bonus', this)">추천 수당</button>
              <button class="tx-tab" onclick="switchTxTab('rank_bonus', this)">직급 수당</button>
              <button class="tx-tab" onclick="switchTxTab('rank_matching', this)">추천 매칭</button>
              <button class="tx-tab" id="txTabCenterFee" onclick="switchTxTab('center_fee', this)" style="display: none;">센터</button>
            </div>
            
            <div style="display:flex; gap:8px; margin-top:12px; margin-bottom:12px; align-items:center;">
              <input type="date" id="txDateFilter" onchange="loadTxHistory()" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:6px 10px; border-radius:6px; font-size:13px; flex:1;">
              <button onclick="downloadTxHistory()" style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px;">
                <i class="fas fa-download"></i> 다운로드
              </button>
            </div>
            
            <div id="txHistoryList" class="tx-list">`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("HTML replaced.");
