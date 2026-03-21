const fs = require('fs');
let code = fs.readFileSync('/home/user/webapp/public/static/admin.html', 'utf8');

// Add select to toolbar
const depthSelectHtml = `
        <select id="orgTreeDepthSelect" class="search-input" style="width:140px; padding:6px 10px;" onchange="if(window.adminCavePath && window.adminCavePath.length>0) window.renderAdminCaveTree();">
            <option value="3">3대까지 보기</option>
            <option value="5">5대까지 보기</option>
            <option value="10">10대까지 보기</option>
            <option value="20" selected>20대까지 보기(기본)</option>
            <option value="50">50대까지 보기(전체)</option>
            <option value="100">100대까지 보기(최대)</option>
        </select>
`;

if (!code.includes('orgTreeDepthSelect')) {
    code = code.replace(
        /<button class="btn btn-primary btn-sm" id="orgTreeSearchBtn">🔍 해당 회원부터 보기<\/button>/,
        `<button class="btn btn-primary btn-sm" id="orgTreeSearchBtn">🔍 해당 회원부터 보기</button>\n${depthSelectHtml}`
    );
}

// Change fetchDepth
code = code.replace(/const fetchDepth = 3; \/\/ admin 항상 3단계 씩 노출/g, 
  "const fetchDepth = parseInt(document.getElementById('orgTreeDepthSelect')?.value) || 20; // 사용자 지정 뎁스 반영");

fs.writeFileSync('/home/user/webapp/public/static/admin.html', code);
console.log('Patched org tree depth');
