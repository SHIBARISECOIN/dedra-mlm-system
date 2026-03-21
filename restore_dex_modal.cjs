const fs = require('fs');
const file = '/home/user/webapp/public/index.html';
let content = fs.readFileSync(file, 'utf8');

const dexModalHtml = `
<!-- DEX Modal -->
<div id="dexModal" class="modal hidden" style="z-index:9999;">
  <div class="modal-overlay" onclick="closeModal('dexModal')"></div>
  <div class="modal-sheet" style="height:80vh; max-height:800px; padding:0; display:flex; flex-direction:column; background:#1c1c28; border-radius: 20px 20px 0 0;">
    <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.1);">
      <h3 style="margin:0; font-size:18px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;">
        <img src="/static/img/ddra-coin.png" style="width:24px; height:24px;" alt="DDRA">
        DDRA Swap
      </h3>
      <button onclick="closeModal('dexModal')" style="background:rgba(255,255,255,0.1); border:none; color:#fff; width:28px; height:28px; border-radius:50%; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
    </div>
    <div id="dexIframeContainer" style="flex:1; width:100%; position:relative;">
      <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#94a3b8; font-size:14px; text-align:center;">
        <i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:12px; color:#10b981;"></i><br>
        DEX 로딩 중...
      </div>
      <iframe id="dexIframe" src="" style="width:100%; height:100%; border:none; position:relative; z-index:2; background:transparent;" allow="clipboard-read; clipboard-write"></iframe>
    </div>
  </div>
</div>
`;

if (!content.includes('id="dexModal"')) {
  content = content.replace('</body>', dexModalHtml + '\n</body>');
  fs.writeFileSync(file, content, 'utf8');
  console.log("dexModal restored");
} else {
  console.log("dexModal already exists");
}
