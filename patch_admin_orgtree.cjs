const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

// 1. Add networkSales and totalInvested to renderNode
code = code.replace(
  /<div style="font-size:10px; color:#64748b; font-family:monospace;">UID: \$\{\(n\.uid\|\|n\.id\)\.slice\(0,8\)\}<\/div>\n\s*<\/div>/g,
  `<div style="font-size:10px; color:#64748b; font-family:monospace;">UID: \${(n.uid||n.id).slice(0,8)}</div>
             </div>
             <div style="font-size:10px; color:#475569; margin-top:4px;">
               자신: <span style="font-weight:600;">\${(n.totalInvested || 0).toLocaleString()}</span> USDT<br/>
               산하(균형): <span style="font-weight:600;">\${(n.networkSales || 0).toLocaleString()}</span> USDT
             </div>`
);

// 2. Add "전체 매출 동기화" button to orgTreePage toolbar
const syncBtnHtml = `
        <button class="btn btn-sm" id="orgTreeSyncSalesBtn" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;">
          <span class="icon">🔄</span> 전체 매출 동기화
        </button>
`;
if (!code.includes('orgTreeSyncSalesBtn')) {
  code = code.replace(
    /<button class="btn btn-gray btn-sm" id="orgTreeRootBtn">🌐 전체 트리 보기<\/button>/,
    `<button class="btn btn-gray btn-sm" id="orgTreeRootBtn">🌐 전체 트리 보기</button>${syncBtnHtml}`
  );
}

fs.writeFileSync('/home/user/webapp/public/static/admin.html', code);
console.log('Patched admin.html HTML structure');
