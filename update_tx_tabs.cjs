const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'public/index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Replace the tx tabs in index.html
const oldTabsRegex = /<div class="tx-history-menu[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<!-- 거래내역 리스트 -->/;

const newTabs = `<div class="tx-history-menu-wrapper" style="overflow-x:auto; white-space:nowrap; margin-bottom:15px; -webkit-overflow-scrolling:touch; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
        <div class="tx-history-menu" style="display:inline-flex; gap:10px; padding:0 4px;">
            <button class="tx-tab active" onclick="switchTxTab('deposit', this)">입금</button>
            <button class="tx-tab" onclick="switchTxTab('withdrawal', this)">출금</button>
            <button class="tx-tab" onclick="switchTxTab('invest', this)">프리즈</button>
            <button class="tx-tab" onclick="switchTxTab('direct_bonus', this)">추천 수당</button>
            <button class="tx-tab" onclick="switchTxTab('rank_bonus', this)">직급 수당</button>
            <button class="tx-tab" onclick="switchTxTab('rank_matching', this)">추천 매칭</button>
            <button class="tx-tab hidden" id="txTabCenterFee" onclick="switchTxTab('center_fee', this)" style="border-color:#a855f7; color:#c084fc;">센터</button>
        </div>
    </div>
    
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:10px;">
        <input type="date" id="txDateFilter" class="w-full bg-slate-800 text-white rounded-lg p-2 text-sm border border-slate-700 focus:border-purple-500 focus:outline-none" style="flex:1;">
        <button onclick="downloadTxHistory()" style="background:#4b5563; color:white; padding:8px 12px; border-radius:8px; font-size:12px; font-weight:bold; white-space:nowrap;">
            <i class="fas fa-download mr-1"></i> 다운로드
        </button>
    </div>

    <!-- 거래내역 리스트 -->`;

if (html.match(/<div class="tx-history-menu-wrapper"/)) {
    html = html.replace(/<div class="tx-history-menu-wrapper"[\s\S]*?<!-- 거래내역 리스트 -->/, newTabs);
} else {
    html = html.replace(/<div class="tx-history-menu"[\s\S]*?<\/div>\s*<!-- 거래내역 리스트 -->/, newTabs);
}

fs.writeFileSync(indexHtmlPath, html);
console.log('index.html updated with new tabs and date filter.');
