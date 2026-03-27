const fs = require('fs');
let code = fs.readFileSync('public/static/admin.html', 'utf8');

const htmlToInsert = `
            <div class="form-group" style="margin-top:8px;">
              <label class="form-label">점검 모드 안내 메시지</label>
              <textarea class="form-input" id="cfg_maintenanceMessage" rows="3" placeholder="기본 메시지 사용 시 비워두세요"></textarea>
            </div>
`;

if (!code.includes('cfg_maintenanceMessage')) {
  code = code.replace(
    `              <select class="form-input" id="cfg_maintenanceMode">\n                <option value="false">🟢 정상 운영</option>\n                <option value="true">🔴 점검 중</option>\n              </select>\n            </div>`,
    `              <select class="form-input" id="cfg_maintenanceMode">\n                <option value="false">🟢 정상 운영</option>\n                <option value="true">🔴 점검 중</option>\n              </select>\n            </div>` + htmlToInsert
  );
  
  code = code.replace(
    `maintenanceMode: document.getElementById('cfg_maintenanceMode').value === 'true',`,
    `maintenanceMode: document.getElementById('cfg_maintenanceMode').value === 'true',\n            maintenanceMessage: _gv('cfg_maintenanceMessage'),`
  );
  
  code = code.replace(
    `document.getElementById('cfg_maintenanceMode').value = s.maintenanceMode?'true':'false';`,
    `document.getElementById('cfg_maintenanceMode').value = s.maintenanceMode?'true':'false';\n    const elMsg = document.getElementById('cfg_maintenanceMessage');\n    if(elMsg) elMsg.value = s.maintenanceMessage||'';`
  );
  
  fs.writeFileSync('public/static/admin.html', code);
  console.log('admin.html patched with maintenanceMessage');
} else {
  console.log('admin.html already patched');
}
